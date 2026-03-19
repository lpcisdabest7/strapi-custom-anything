const admin = [
  {
    method: 'GET',
    path: '/options/:groupKey',
    handler: 'dynamic-enum.getOptions',
    config: {
      policies: ['admin::isAuthenticatedAdmin'],
    },
  },
  {
    method: 'POST',
    path: '/options/:groupKey',
    handler: 'dynamic-enum.addOption',
    config: {
      policies: ['admin::isAuthenticatedAdmin'],
    },
  },
  {
    method: 'DELETE',
    path: '/options/:groupKey/:value',
    handler: 'dynamic-enum.removeOption',
    config: {
      policies: ['admin::isAuthenticatedAdmin'],
    },
  },
  {
    method: 'PUT',
    path: '/options/:groupKey/reorder',
    handler: 'dynamic-enum.reorderOptions',
    config: {
      policies: ['admin::isAuthenticatedAdmin'],
    },
  },
];

export default {
  admin,
};
