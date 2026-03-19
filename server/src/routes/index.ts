const admin = {
  type: 'admin',
  routes: [
    {
      method: 'GET',
      path: '/options/:groupKey',
      handler: 'dynamic-enum.getOptions',
      config: {
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/options/:groupKey',
      handler: 'dynamic-enum.addOption',
      config: {
        policies: [],
      },
    },
    {
      method: 'DELETE',
      path: '/options/:groupKey/:value',
      handler: 'dynamic-enum.removeOption',
      config: {
        policies: [],
      },
    },
    {
      method: 'PUT',
      path: '/options/:groupKey/reorder',
      handler: 'dynamic-enum.reorderOptions',
      config: {
        policies: [],
      },
    },
  ],
};

export default {
  admin,
};
