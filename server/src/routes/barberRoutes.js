const express = require('express');
const { getBarbers, createBarber, updateBarber, deleteBarber } = require('../controllers/barberController');
const {
  listScheduleBlocks,
  createScheduleBlock,
  deleteScheduleBlock,
} = require('../controllers/scheduleBlockController');
const authMiddleware = require('../middlewares/authMiddleware');
const optionalAuthMiddleware = authMiddleware.optionalAuthMiddleware;

const router = express.Router();

/** Express 5: garante que rejeições async vão ao handler de erros em vez de resposta vazia. */
const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

router.get('/', optionalAuthMiddleware, wrap(getBarbers));
router.get('/:id/schedule-blocks', authMiddleware, wrap(listScheduleBlocks));
router.post('/:id/schedule-blocks', authMiddleware, wrap(createScheduleBlock));
router.delete('/:id/schedule-blocks/:blockId', authMiddleware, wrap(deleteScheduleBlock));
router.post('/', authMiddleware, wrap(createBarber));
router.put('/:id', authMiddleware, wrap(updateBarber));
router.delete('/:id', authMiddleware, wrap(deleteBarber));

module.exports = router;
