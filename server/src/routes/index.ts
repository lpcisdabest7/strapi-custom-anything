const admin = {
  type: 'admin',
  routes: [
    {
      method: 'GET',
      path: '/options/:groupKey',
      handler: 'dynamic-enum.getOptions',
      config: { auth: false, policies: [] },
    },
    {
      method: 'POST',
      path: '/options/:groupKey',
      handler: 'dynamic-enum.addOption',
      config: { auth: false, policies: [] },
    },
    {
      method: 'DELETE',
      path: '/options/:groupKey/:value',
      handler: 'dynamic-enum.removeOption',
      config: { auth: false, policies: [] },
    },
    {
      method: 'PUT',
      path: '/options/:groupKey/reorder',
      handler: 'dynamic-enum.reorderOptions',
      config: { auth: false, policies: [] },
    },
  ],
};

export default {
  admin,
};
