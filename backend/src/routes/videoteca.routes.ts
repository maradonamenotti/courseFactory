import { Router } from 'express';

const router = Router();

router.get('/videos', async (req, res) => {
  try {
    const response = await fetch('https://videos.maradonamenotti.cloud/api/videos?folder_id=all');
    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    console.error('Error proxying videoteca videos:', error?.message);
    res.status(500).json({ success: false, error: 'Error al conectar con la videoteca' });
  }
});

export default router;
