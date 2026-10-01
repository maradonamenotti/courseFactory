import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { PortalConfig } from '../entities/PortalConfig';

const portalRepo = () => AppDataSource.getRepository(PortalConfig);

// GET /api/portals
export const getPortals = async (_req: Request, res: Response): Promise<void> => {
  try {
    const portals = await portalRepo().find({ order: { createdAt: 'DESC' } });
    res.json(portals);
  } catch (error) {
    console.error('Error fetching portals:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// GET /api/portals/public/:idOrSlug (Unauthenticated / Embed access)
export const getPublicPortal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idOrSlug } = req.params;
    let portal = await portalRepo().findOne({ where: { id: idOrSlug, active: true } });
    
    if (!portal) {
      portal = await portalRepo().findOne({ where: { slug: idOrSlug, active: true } });
    }

    if (!portal) {
      res.status(404).json({ message: 'Portal no encontrado o inactivo' });
      return;
    }

    res.json(portal);
  } catch (error) {
    console.error('Error fetching public portal:', error);
    res.status(500).json({ message: 'Error al recuperar el portal' });
  }
};

// GET /api/portals/:id
export const getPortalById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const portal = await portalRepo().findOne({ where: { id } });
    if (!portal) {
      res.status(404).json({ message: 'Portal no encontrado' });
      return;
    }
    res.json(portal);
  } catch (error) {
    console.error('Error fetching portal by ID:', error);
    res.status(500).json({ message: 'Error al buscar el portal' });
  }
};

// POST /api/portals
export const createPortal = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.isAdmin && !req.user?.canEdit) {
      res.status(403).json({ message: 'No tenés permisos para gestionar portales' });
      return;
    }

    const { title, subtitle, folderId, slug, announcements, licenciasConfig, moodleCourseId, active } = req.body;

    if (!title) {
      res.status(400).json({ message: 'El título del portal es obligatorio' });
      return;
    }

    const portal = portalRepo().create({
      title: title.trim(),
      subtitle: subtitle || null,
      folderId: folderId || null,
      slug: slug || null,
      announcements: typeof announcements === 'string' ? announcements : JSON.stringify(announcements || []),
      licenciasConfig: typeof licenciasConfig === 'string' ? licenciasConfig : JSON.stringify(licenciasConfig || []),
      moodleCourseId: moodleCourseId || null,
      active: active !== undefined ? active : true,
    });

    const saved = await portalRepo().save(portal);
    res.status(201).json(saved);
  } catch (error) {
    console.error('Error creating portal:', error);
    res.status(500).json({ message: 'Error al crear el portal' });
  }
};

// PUT /api/portals/:id
export const updatePortal = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.isAdmin && !req.user?.canEdit) {
      res.status(403).json({ message: 'No tenés permisos para editar portales' });
      return;
    }

    const { id } = req.params;
    const { title, subtitle, folderId, slug, announcements, licenciasConfig, moodleCourseId, active } = req.body;

    const portal = await portalRepo().findOne({ where: { id } });
    if (!portal) {
      res.status(404).json({ message: 'Portal no encontrado' });
      return;
    }

    if (title !== undefined) portal.title = title.trim();
    if (subtitle !== undefined) portal.subtitle = subtitle;
    if (folderId !== undefined) portal.folderId = folderId;
    if (slug !== undefined) portal.slug = slug;
    if (announcements !== undefined) {
      portal.announcements = typeof announcements === 'string' ? announcements : JSON.stringify(announcements);
    }
    if (licenciasConfig !== undefined) {
      portal.licenciasConfig = typeof licenciasConfig === 'string' ? licenciasConfig : JSON.stringify(licenciasConfig);
    }
    if (moodleCourseId !== undefined) portal.moodleCourseId = moodleCourseId;
    if (active !== undefined) portal.active = active;

    const updated = await portalRepo().save(portal);
    res.json(updated);
  } catch (error) {
    console.error('Error updating portal:', error);
    res.status(500).json({ message: 'Error al actualizar el portal' });
  }
};

// DELETE /api/portals/:id
export const deletePortal = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.isAdmin && !req.user?.canEdit) {
      res.status(403).json({ message: 'No tenés permisos para eliminar portales' });
      return;
    }

    const { id } = req.params;
    const portal = await portalRepo().findOne({ where: { id } });
    if (!portal) {
      res.status(404).json({ message: 'Portal no encontrado' });
      return;
    }

    await portalRepo().remove(portal);
    res.json({ message: 'Portal eliminado con éxito' });
  } catch (error) {
    console.error('Error deleting portal:', error);
    res.status(500).json({ message: 'Error al eliminar el portal' });
  }
};
