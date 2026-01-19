import express from 'express';
import { AuthRouters } from '../modules/Auth/Auth.routes';
import { UserRouters } from '../modules/User/user.routes';
import { PaymentRoutes } from '../modules/Payment/payment.route';
import { FollowRoutes } from '../modules/follow/follow.routes';
import { notificationsRoute } from '../modules/Notifications/Notification.routes';
import { testRoutes } from "../modules/test/test.routes";


const router = express.Router();

const moduleRoutes = [
  {
    path: '/auth',
    route: AuthRouters,
  },
  {
    path: '/user',
    route: UserRouters,
  },
  {
    path: '/payment',
    route: PaymentRoutes,
  },
  {
    path: '/follow',
    route: FollowRoutes,
  },
  {
    path: '/notifications',
    route: notificationsRoute,
  },


  {
    path: "/tests",
    route: testRoutes,
  },
];

moduleRoutes.forEach(route => router.use(route.path, route.route));

export default router;
