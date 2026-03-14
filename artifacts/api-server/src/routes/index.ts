import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import usinasRouter from "./usinas.js";
import funcionariosRouter from "./funcionarios.js";
import registrosRouter from "./registros.js";
import dashboardRouter from "./dashboard.js";
import auditoriaRouter from "./auditoria.js";
import relatoriosRouter from "./relatorios.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usinasRouter);
router.use(funcionariosRouter);
router.use(registrosRouter);
router.use(dashboardRouter);
router.use(auditoriaRouter);
router.use(relatoriosRouter);

export default router;
