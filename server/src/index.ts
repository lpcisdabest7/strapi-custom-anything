import register from './register';
import bootstrap from './bootstrap';
import controllers from './controllers/dynamic-enum';
import routes from './routes';

export default {
  register,
  bootstrap,
  controllers: {
    'dynamic-enum': controllers,
  },
  routes,
};
