import { Router } from "express";
import healthRouter from "./health";
import yudatesRouter from "./yudates";
import usersRouter from "./users";
import setupRouter from "./setup";
import exploreRouter from "./explore";
import notificationsRouter from "./notifications";
import uploadRouter from "./upload";
import walletRouter from "./wallet";
import marketRouter from "./market";
import gamesRouter from "./games";
import rankingsRouter from "./rankings";

const router = Router();

router.use(healthRouter);
router.use(yudatesRouter);
router.use(setupRouter);
router.use(usersRouter);
router.use(exploreRouter);
router.use(notificationsRouter);
router.use(uploadRouter);
router.use(walletRouter);
router.use(marketRouter);
router.use(gamesRouter);
router.use(rankingsRouter);

export default router;
