import { cn } from '../../../shared/lib/utils';
import { useMemo } from 'react';

interface AccountAvatarProps {
  email: string;
  provider?: string;
  className?: string;
}

export const AccountAvatar = ({ email, provider, className }: AccountAvatarProps) => {
  const { colorClass, initials } = useMemo(() => {
    const colors = [
      'bg-red-500',
      'bg-orange-500',
      'bg-amber-500',
      'bg-green-500',
      'bg-emerald-500',
      'bg-teal-500',
      'bg-cyan-500',
      'bg-sky-500',
      'bg-blue-500',
      'bg-indigo-500',
      'bg-violet-500',
      'bg-purple-500',
      'bg-fuchsia-500',
      'bg-pink-500',
      'bg-rose-500',
    ];

    // Generate a consistent index from the email + provider (to differ if same email)
    const seed = provider ? `${email}-${provider}` : email;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;

    const colorClass = colors[index];

    // Extract initials
    let initials = '';
    const parts = email.split('@')[0].split(/[._-]/);
    if (parts.length > 1) {
      initials = (parts[0][0] + parts[1][0]).toUpperCase();
    } else {
      initials = parts[0].substring(0, 2).toUpperCase();
    }

    return { colorClass, initials };
  }, [email, provider]);

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full text-white font-medium text-xs border border-white/10',
        colorClass,
        className,
      )}
    >
      {initials}
    </div>
  );
};
