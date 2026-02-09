import { useState, useEffect, useCallback, useMemo } from 'react';
import { getApiBaseUrl } from '../../../utils/apiUrl';
import { fetchProviders } from '../../../config/providers';
import { Account, Pagination, FlatAccount } from '../types';
import { StatsPeriod } from '../../models/types';

export const useAccounts = () => {
  const [accounts, setAccounts] = useState<FlatAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverPort, setServerPort] = useState<number | null>(null);
  const [providerConfigs, setProviderConfigs] = useState<any[]>([]);

  // Filter & Pagination states
  const [searchQuery, setSearchQuery] = useState('');
  const [period, setPeriod] = useState<StatsPeriod>('day');

  // Advanced filters
  const [providerFilter, setProviderFilter] = useState<string>('');
  const [emailFilter, setEmailFilter] = useState<string[]>([]); // Changed to array for multi-select
  const [successRateRange, setSuccessRateRange] = useState<[number, number] | null>(null);

  // Max Load (requests, tokens)
  const [maxReqRange, setMaxReqRange] = useState<[number, number] | null>(null);
  const [maxTokenRange, setMaxTokenRange] = useState<[number, number] | null>(null);
  // Totals (requests, tokens)
  const [totalReqRange, setTotalReqRange] = useState<[number, number] | null>(null);
  const [totalTokenRange, setTotalTokenRange] = useState<[number, number] | null>(null);

  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 10,
    total_pages: 1,
  });

  const [allStats, setAllStats] = useState<any[]>([]); // Store global stats for min/max calculation
  const [allAccounts, setAllAccounts] = useState<FlatAccount[]>([]); // Store all accounts for email options

  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{ id: string; email?: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    const startServer = async () => {
      try {
        const res = await window.api.server.start();
        if (res.success && res.port) {
          setServerPort(res.port);
        }
      } catch (e) {
        console.error('Error starting server:', e);
      }
    };
    startServer();
  }, []);

  const fetchAccounts = useCallback(
    async (page = 1, limit = 10, silent = false) => {
      if (!serverPort) return;
      if (!silent) setLoading(true);
      try {
        const pConfigs = await fetchProviders(serverPort);
        setProviderConfigs(pConfigs);

        const baseUrl = getApiBaseUrl(serverPort);
        const queryParams = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
          period: period,
        });

        if (searchQuery) queryParams.append('email', searchQuery);
        // For multi-email filter, send each email as separate param or join
        // Backend might need update to handle multiple emails
        // For now, we'll filter client-side if multiple emails selected
        if (emailFilter.length === 1) {
          queryParams.append('email', emailFilter[0]);
        }
        if (providerFilter && providerFilter !== 'all')
          queryParams.append('provider_id', providerFilter);

        const [accountsRes, statsRes] = await Promise.all([
          fetch(`${baseUrl}/v1/accounts?${queryParams.toString()}`),
          fetch(`${baseUrl}/v1/stats?period=${period}`),
        ]);

        const accountsResult = await accountsRes.json();
        const statsResult = await statsRes.json();

        if (accountsResult.success) {
          const accountList: Account[] = accountsResult.data.accounts;
          const accountStats = statsResult.success ? statsResult.data.accounts : [];

          setAllStats(accountStats); // Store global stats

          const enrichedAccounts: FlatAccount[] = accountList.map((acc) => {
            const stats = accountStats.find((s: any) => s.id === acc.id);
            const pConfig = pConfigs.find(
              (p) => p.provider_id.toLowerCase() === acc.provider_id.toLowerCase(),
            );

            return {
              ...acc,
              total_requests: stats?.total_requests || 0,
              successful_requests: stats?.successful_requests || 0,
              total_tokens: stats?.total_tokens || 0,
              isActive: pConfig ? pConfig.is_enabled : true,
            };
          });

          setAccounts(enrichedAccounts);
          setAllAccounts(enrichedAccounts); // Store all accounts for email options
          setPagination(accountsResult.data.pagination);
        }
      } catch (error) {
        console.error('Failed to fetch accounts:', error);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [serverPort, searchQuery, period, providerFilter, emailFilter],
  );

  useEffect(() => {
    if (serverPort) {
      fetchAccounts(1, pagination.limit);
    }
  }, [serverPort, fetchAccounts]);

  // Client-side filtering for ranges and multi-email
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      // Multi-email filter (client-side)
      if (emailFilter.length > 0) {
        const matchesEmail = emailFilter.some((email) =>
          acc.email?.toLowerCase().includes(email.toLowerCase()),
        );
        if (!matchesEmail) return false;
      }

      const totalReq = acc.total_requests || 0;
      const successReq = acc.successful_requests || 0;
      const totalTokens = acc.total_tokens || 0;

      // Success Rate calculation
      const successRate = totalReq > 0 ? (successReq / totalReq) * 100 : 0;

      if (successRateRange) {
        if (successRate < successRateRange[0] || successRate > successRateRange[1]) return false;
      }

      // Totals
      if (totalReqRange) {
        if (totalReq < totalReqRange[0] || totalReq > totalReqRange[1]) return false;
      }
      if (totalTokenRange) {
        if (totalTokens < totalTokenRange[0] || totalTokens > totalTokenRange[1]) return false;
      }

      return true;
    });
  }, [accounts, emailFilter, successRateRange, totalReqRange, totalTokenRange]);

  const executeDelete = async () => {
    if (!serverPort) return;
    setDeleteLoading(true);
    try {
      const baseUrl = getApiBaseUrl(serverPort);

      if (deleteItem) {
        const response = await fetch(`${baseUrl}/v1/accounts/${deleteItem.id}`, {
          method: 'DELETE',
        });
        const result = await response.json();
        if (result.success) {
          fetchAccounts(pagination.page, pagination.limit, true);
        }
      } else if (selectedAccounts.size > 0) {
        await Promise.all(
          Array.from(selectedAccounts).map((id) =>
            fetch(`${baseUrl}/v1/accounts/${id}`, { method: 'DELETE' }),
          ),
        );
        setSelectedAccounts(new Set());
        fetchAccounts(pagination.page, pagination.limit, true);
      }
      setConfirmOpen(false);
      setDeleteItem(null);
    } catch (error) {
      console.error('Failed to delete accounts:', error);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDelete = (id: string, email?: string) => {
    setDeleteItem({ id, email });
    setConfirmOpen(true);
  };

  const handleBulkDelete = () => {
    setDeleteItem(null);
    setConfirmOpen(true);
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedAccounts);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedAccounts(newSelected);
  };

  const toggleAll = () => {
    if (selectedAccounts.size === accounts.length && accounts.length > 0) {
      setSelectedAccounts(new Set());
    } else {
      setSelectedAccounts(new Set(accounts.map((acc) => acc.id)));
    }
  };

  return {
    accounts: filteredAccounts, // Return filtered view
    rawAccounts: accounts, // Expose raw page
    allStats, // Expose all stats for global range calculation
    allAccounts, // Expose all accounts for email options
    loading,
    serverPort,
    providerConfigs,
    searchQuery,
    setSearchQuery,
    period,
    setPeriod,
    pagination,
    selectedAccounts,
    setSelectedAccounts,
    confirmOpen,
    setConfirmOpen,
    deleteItem,
    deleteLoading,
    executeDelete,
    fetchAccounts,
    handleDelete,
    handleBulkDelete,
    toggleSelection,
    toggleAll,

    // New Filter States
    providerFilter,
    setProviderFilter,
    emailFilter,
    setEmailFilter,
    successRateRange,
    setSuccessRateRange,
    totalReqRange,
    setTotalReqRange,
    totalTokenRange,
    setTotalTokenRange,
    maxReqRange,
    setMaxReqRange,
    maxTokenRange,
    setMaxTokenRange,
  };
};
