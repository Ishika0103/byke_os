import { Router } from 'express';
import { createRoleSchema, roleListQuerySchema, updateRoleSchema } from '@byke-os/shared';
import { validateBody, validateObjectIdParam, validateQuery } from '../../middlewares/validate';
import { roleController } from './role.controller';

/** Mounted behind `authenticate` in routes.ts. */
export const roleRouter = Router();

roleRouter.param('id', validateObjectIdParam);

roleRouter.get('/', validateQuery(roleListQuerySchema), roleController.list);
roleRouter.post('/', validateBody(createRoleSchema), roleController.create);
roleRouter.get('/:id', roleController.getById);
roleRouter.patch('/:id', validateBody(updateRoleSchema), roleController.update);
roleRouter.delete('/:id', roleController.remove);
