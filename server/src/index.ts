import register from './register';
import controllers from './controllers/dynamic-enum';
import routes from './routes';

export default {
  register,
  controllers: {
    'dynamic-enum': controllers,
  },
  routes,
};
