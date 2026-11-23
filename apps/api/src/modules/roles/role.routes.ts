import { Router } from 'express';
import { createRoleSchema, roleListQuerySchema, updateRoleSchema } from '@byke-os/shared';
import { authorize, requireSuperAdmin } from '../../middlewares/authorize';
import { validateBody, validateObjectIdParam, validateQuery } from '../../middlewares/validate';
import { roleController } from './role.controller';

/** Mounted behind `authenticate` in routes.ts. */
export const roleRouter = Router();

roleRouter.param('id', validateObjectIdParam);

// Names only, for the role picker / filter in the user screens.
roleRouter.get('/options', authorize('view-user', 'add-user', 'edit-user'), roleController.options);

// Everything else: Super Admin only (Plan 06).
roleRouter.use(requireSuperAdmin);

roleRouter.get('/', validateQuery(roleListQuerySchema), roleController.list);
roleRouter.post('/', validateBody(createRoleSchema), roleController.create);
roleRouter.get('/:id', roleController.getById);
roleRouter.patch('/:id', validateBody(updateRoleSchema), roleController.update);
roleRouter.delete('/:id', roleController.remove);
