export const getBusinessCount = async (): Promise<{ count: number }> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ count: 2134 });
    }, 1000);
  });
};
