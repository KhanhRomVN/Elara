import { useState, useEffect, useCallback } from 'react';
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
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 10,
    total_pages: 1,
  });

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

        const [accountsRes, statsRes] = await Promise.all([
          fetch(`${baseUrl}/v1/accounts?${queryParams.toString()}`),
          fetch(`${baseUrl}/v1/stats?period=${period}`),
        ]);

        const accountsResult = await accountsRes.json();
        const statsResult = await statsRes.json();

        if (accountsResult.success) {
          const accountList: Account[] = accountsResult.data.accounts;
          const accountStats = statsResult.success ? statsResult.data.accounts : [];

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
          setPagination(accountsResult.data.pagination);
        }
      } catch (error) {
        console.error('Failed to fetch accounts:', error);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [serverPort, searchQuery, period],
  );

  useEffect(() => {
    if (serverPort) {
      fetchAccounts(1, pagination.limit);
    }
  }, [serverPort, fetchAccounts]);

  const executeDelete = async () => {
    if (!serverPort) return;
    setDeleteLoading(true);
    try {
      const baseUrl = getApiBaseUrl(serverPort);

      if (deleteItem) {
        // Individual delete
        const response = await fetch(`${baseUrl}/v1/accounts/${deleteItem.id}`, {
          method: 'DELETE',
        });
        const result = await response.json();
        if (result.success) {
          fetchAccounts(pagination.page, pagination.limit, true);
        }
      } else if (selectedAccounts.size > 0) {
        // Bulk delete
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
    accounts,
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
  };
};
