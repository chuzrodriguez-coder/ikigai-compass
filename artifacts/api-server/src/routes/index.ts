import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import discoveryRouter from "./discovery";
import hypothesesRouter from "./hypotheses";
import growthRouter from "./growth";
import checkinsRouter from "./checkins";
import coachingRouter from "./coaching";
import obstaclesRouter from "./obstacles";
import dashboardRouter from "./dashboard";
import openaiRouter from "./openai";
import goalsRouter from "./goals";
import schedulingRouter from "./scheduling";
import insightsRouter from "./insights";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(discoveryRouter);
router.use(hypothesesRouter);
router.use(growthRouter);
router.use(checkinsRouter);
router.use(coachingRouter);
router.use(obstaclesRouter);
router.use(dashboardRouter);
router.use(openaiRouter);
router.use(goalsRouter);
router.use(schedulingRouter);
router.use(insightsRouter);

export default router;
