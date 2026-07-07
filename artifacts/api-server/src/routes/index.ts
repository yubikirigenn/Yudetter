import { Router } from "express";
import healthRouter from "./health";
import yudatesRouter from "./yudates";
import usersRouter from "./users";
import exploreRouter from "./explore";
import notificationsRouter from "./notifications";

const router = Router();

router.use(healthRouter);
router.use(yudatesRouter);
router.use(usersRouter);
router.use(exploreRouter);
router.use(notificationsRouter);

export default router;
