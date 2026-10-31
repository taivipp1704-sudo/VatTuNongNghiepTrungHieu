let token: string | null = null;
export const credentials = {
  get: async () => token,
  set: async (value: string) => {
    token = value;
  },
  remove: async () => {
    token = null;
  },
};
