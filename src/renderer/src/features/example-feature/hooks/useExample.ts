import { useState } from 'react';

export const useExample = () => {
  const [value, setValue] = useState(0);
  return { value, setValue };
};
