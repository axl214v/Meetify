const Conference = require('../models/Conference');
const User = require('../models/User');

// Создание новой конференции
const createConference = async (req, res) => {
  try {
    const { name, password, maxParticipants, isPublic, description, startTime, endTime } = req.body;
    const hostId = req.user.userId;

    // Проверяем обязательные поля
    if (!name) {
      return res.status(400).json({ message: 'Conference name is required' });
    }

    // Создаем конференцию
    const conference = await Conference.create({
      name,
      hostId,
      password,
      maxParticipants,
      isPublic,
      description,
      startTime,
      endTime
    });

    res.status(201).json({ 
      message: 'Conference created successfully',
      conference 
    });
  } catch (error) {
    console.error('Error creating conference:', error);
    res.status(500).json({ message: 'Error creating conference' });
  }
};

// Получение информации о конференции
const getConference = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Проверяем существование конференции
    const conference = await Conference.findById(id);
    if (!conference) {
      return res.status(404).json({ message: 'Conference not found' });
    }

    // Проверяем доступ к конференции
    const hasAccess = await Conference.hasAccess(id, userId, req.body.password);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Получаем количество участников
    const participantCount = await Conference.getParticipantCount(id);
    
    res.json({ 
      conference: {
        ...conference,
        participantCount
      }
    });
  } catch (error) {
    console.error('Error getting conference:', error);
    res.status(500).json({ message: 'Error fetching conference' });
  }
};

// Получение списка конференций
const getConferences = async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const userId = req.user.userId;

    // Получаем конференции
    const conferences = await Conference.findAll(limit, offset);
    
    // Получаем количество участников для каждой конференции
    const conferencesWithCount = await Promise.all(conferences.map(async (conference) => {
      const participantCount = await Conference.getParticipantCount(conference.id);
      return {
        ...conference,
        participantCount
      };
    }));

    res.json({ conferences: conferencesWithCount });
  } catch (error) {
    console.error('Error fetching conferences:', error);
    res.status(500).json({ message: 'Error fetching conferences' });
  }
};

// Обновление конференции
const updateConference = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const updateData = req.body;

    // Проверяем, что пользователь является хостом конференции
    const conference = await Conference.findById(id);
    if (!conference) {
      return res.status(404).json({ message: 'Conference not found' });
    }

    if (conference.host_id !== userId) {
      return res.status(403).json({ message: 'You do not have permission to update this conference' });
    }

    // Обновляем конференцию
    const updatedConference = await Conference.update(id, updateData);
    
    res.json({ 
      message: 'Conference updated successfully',
      conference: updatedConference 
    });
  } catch (error) {
    console.error('Error updating conference:', error);
    res.status(500).json({ message: 'Error updating conference' });
  }
};

// Удаление конференции
const deleteConference = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Проверяем, что пользователь является хостом конференции
    const conference = await Conference.findById(id);
    if (!conference) {
      return res.status(404).json({ message: 'Conference not found' });
    }

    if (conference.host_id !== userId) {
      return res.status(403).json({ message: 'You do not have permission to delete this conference' });
    }

    // Удаляем конференцию
    await Conference.delete(id);
    
    res.json({ message: 'Conference deleted successfully' });
  } catch (error) {
    console.error('Error deleting conference:', error);
    res.status(500).json({ message: 'Error deleting conference' });
  }
};

// Присоединение к конференции
const joinConference = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Проверяем существование конференции
    const conference = await Conference.findById(id);
    if (!conference) {
      return res.status(404).json({ message: 'Conference not found' });
    }

    // Проверяем пароль если требуется
    if (conference.password && req.body.password !== conference.password) {
      return res.status(403).json({ message: 'Incorrect password' });
    }

    // Проверяем максимальное количество участников
    const participantCount = await Conference.getParticipantCount(id);
    if (conference.max_participants && participantCount >= conference.max_participants) {
      return res.status(403).json({ message: 'Conference is full' });
    }

    // Добавляем пользователя в участники
    await Conference.addParticipant(id, userId);

    res.json({ message: 'Successfully joined conference' });
  } catch (error) {
    console.error('Error joining conference:', error);
    res.status(500).json({ message: 'Error joining conference' });
  }
};

// Покидание конференции
const leaveConference = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Удаляем пользователя из участников
    await Conference.removeParticipant(id, userId);

    res.json({ message: 'Successfully left conference' });
  } catch (error) {
    console.error('Error leaving conference:', error);
    res.status(500).json({ message: 'Error leaving conference' });
  }
};

// Получение участников конференции
const getConferenceParticipants = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Проверяем существование конференции
    const conference = await Conference.findById(id);
    if (!conference) {
      return res.status(404).json({ message: 'Conference not found' });
    }

    // Проверяем доступ к конференции
    const hasAccess = await Conference.hasAccess(id, userId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Получаем участников
    const participants = await Conference.getParticipants(id);
    
    res.json({ participants });
  } catch (error) {
    console.error('Error getting conference participants:', error);
    res.status(500).json({ message: 'Error fetching participants' });
  }
};

module.exports = {
  createConference,
  getConference,
  getConferences,
  updateConference,
  deleteConference,
  joinConference,
  leaveConference,
  getConferenceParticipants
};