const Conference = require('../models/Conference');
const User = require('../models/User');

// Вспомогательная функция для валидации
const validateConferenceData = (data) => {
  const errors = [];

  if (!data.name || data.name.trim().length === 0) {
    errors.push('Conference name is required');
  }

  if (data.name && data.name.length > 255) {
    errors.push('Conference name is too long (max 255 characters)');
  }

  if (data.description && data.description.length > 1000) {
    errors.push('Description is too long (max 1000 characters)');
  }

  if (data.maxParticipants) {
    const max = parseInt(data.maxParticipants);
    if (isNaN(max) || max < 2 || max > 1000) {
      errors.push('Max participants must be between 2 and 1000');
    }
  }

  if (data.startTime && data.endTime) {
    const start = new Date(data.startTime);
    const end = new Date(data.endTime);
    if (start >= end) {
      errors.push('End time must be after start time');
    }
  }

  return errors;
};

// Создание новой конференции
const createConference = async (req, res) => {
  try {
    const { name, password, maxParticipants, isPublic, description, startTime, endTime } = req.body;
    const hostId = req.user.userId;

    // Валидация данных
    const validationErrors = validateConferenceData(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: validationErrors 
      });
    }

    // Создаем конференцию
    const conference = await Conference.create({
      name: name.trim(),
      hostId,
      password,
      maxParticipants: maxParticipants ? parseInt(maxParticipants) : null,
      isPublic: isPublic !== undefined ? isPublic : true,
      description: description ? description.trim() : null,
      startTime,
      endTime
    });

    // Автоматически добавляем хоста как участника
    await Conference.addParticipant(conference.id, hostId);

    // Убираем пароль из ответа
    const { password: _, ...conferenceData } = conference;

    res.status(201).json({ 
      message: 'Conference created successfully',
      conference: conferenceData
    });
  } catch (error) {
    console.error('Error creating conference:', error.message, { 
      userId: req.user.userId 
    });
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
    const isHost = conference.host_id === userId;
    const isParticipant = await Conference.isParticipant(id, userId);
    const isPublic = conference.is_public;

    // Если не хост, не участник и конференция приватная - отказ
    if (!isHost && !isParticipant && !isPublic) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Получаем количество участников
    const participantCount = await Conference.getParticipantCount(id);
    
    // Убираем пароль из ответа
    const { password, ...conferenceData } = conference;

    // Добавляем информацию о текущем пользователе
    const responseData = {
      ...conferenceData,
      participantCount,
      isHost,
      isParticipant,
      hasPassword: conference.password
    };

    res.json({ conference: responseData });
  } catch (error) {
    console.error('Error getting conference:', error.message, {
      conferenceId: req.params.id,
      userId: req.user.userId
    });
    res.status(500).json({ message: 'Error fetching conference' });
  }
};

// Получение списка конференций
const getConferences = async (req, res) => {
  try {
    // Валидация и нормализация параметров пагинации
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    const userId = req.user.userId;

    // Фильтры
    const filters = {
      isPublic: req.query.isPublic !== undefined ? req.query.isPublic === 'true' : undefined,
      status: req.query.status, // 'upcoming', 'ongoing', 'ended'
      search: req.query.search ? req.query.search.trim() : undefined
    };

    // Получаем конференции с количеством участников одним запросом
    const result = await Conference.findAllWithParticipantCount({
      limit,
      offset,
      userId,
      filters
    });

    // Убираем пароли из всех конференций
    const conferencesWithoutPasswords = result.conferences.map(conf => {
      const { password, ...confData } = conf;
      return confData;
    });

    res.json({ 
      conferences: conferencesWithoutPasswords,
      total: result.total,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error fetching conferences:', error.message, {
      userId: req.user.userId
    });
    res.status(500).json({ message: 'Error fetching conferences' });
  }
};

// Обновление конференции
const updateConference = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const updateData = req.body;

    // Проверяем существование конференции
    const conference = await Conference.findById(id);
    if (!conference) {
      return res.status(404).json({ message: 'Conference not found' });
    }

    // Проверяем, что пользователь является хостом
    if (conference.host_id !== userId) {
      return res.status(403).json({ 
        message: 'You do not have permission to update this conference' 
      });
    }

    // Валидация обновляемых данных
    const validationErrors = validateConferenceData({
      name: updateData.name || conference.name,
      description: updateData.description,
      maxParticipants: updateData.maxParticipants,
      startTime: updateData.startTime,
      endTime: updateData.endTime
    });

    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: validationErrors 
      });
    }

    // Если уменьшается maxParticipants, проверяем текущее количество
    if (updateData.maxParticipants) {
      const participantCount = await Conference.getParticipantCount(id);
      if (participantCount > parseInt(updateData.maxParticipants)) {
        return res.status(400).json({ 
          message: `Cannot set max participants lower than current count (${participantCount})` 
        });
      }
    }

    // Обновляем конференцию
    const updatedConference = await Conference.update(id, updateData);
    
    // Убираем пароль из ответа
    const { password, ...conferenceData } = updatedConference;

    res.json({ 
      message: 'Conference updated successfully',
      conference: conferenceData
    });
  } catch (error) {
    console.error('Error updating conference:', error.message, {
      conferenceId: req.params.id,
      userId: req.user.userId
    });
    res.status(500).json({ message: 'Error updating conference' });
  }
};

// Удаление конференции
const deleteConference = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Проверяем существование конференции
    const conference = await Conference.findById(id);
    if (!conference) {
      return res.status(404).json({ message: 'Conference not found' });
    }

    // Проверяем, что пользователь является хостом
    if (conference.host_id !== userId) {
      return res.status(403).json({ 
        message: 'You do not have permission to delete this conference' 
      });
    }

    // Удаляем конференцию (каскадно удалятся все связанные записи)
    await Conference.delete(id);
    
    res.json({ message: 'Conference deleted successfully' });
  } catch (error) {
    console.error('Error deleting conference:', error.message, {
      conferenceId: req.params.id,
      userId: req.user.userId
    });
    res.status(500).json({ message: 'Error deleting conference' });
  }
};

// Присоединение к конференции
const joinConference = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    const userId = req.user.userId;

    // Проверяем существование конференции
    const conference = await Conference.findById(id);
    if (!conference) {
      return res.status(404).json({ message: 'Conference not found' });
    }

    // Проверяем, не является ли пользователь уже участником
    const isParticipant = await Conference.isParticipant(id, userId);
    if (isParticipant) {
      return res.status(200).json({ 
        message: 'Already a participant',
        alreadyJoined: true
      });
    }

    // Проверяем пароль если конференция защищена
    if (conference.password) {
      if (!password) {
        return res.status(400).json({ 
          message: 'Password required',
          requiresPassword: true
        });
      }
      if (password !== conference.password) {
        return res.status(403).json({ message: 'Incorrect password' });
      }
    }

    // Проверяем время начала конференции
    if (conference.start_time) {
      const now = new Date();
      const startTime = new Date(conference.start_time);
      if (now < startTime) {
        return res.status(403).json({ 
          message: 'Conference has not started yet',
          startTime: conference.start_time
        });
      }
    }

    // Проверяем, не закончилась ли конференция
    if (conference.end_time) {
      const now = new Date();
      const endTime = new Date(conference.end_time);
      if (now > endTime) {
        return res.status(403).json({ message: 'Conference has ended' });
      }
    }

    // Добавляем пользователя в участники
    // Проверка на максимальное количество участников происходит внутри
    const result = await Conference.addParticipant(id, userId);

    if (!result.success) {
      return res.status(403).json({ 
        message: result.message || 'Unable to join conference' 
      });
    }

    res.json({ 
      message: 'Successfully joined conference',
      conferenceId: id
    });
  } catch (error) {
    console.error('Error joining conference:', error.message, {
      conferenceId: req.params.id,
      userId: req.user.userId
    });
    
    // Специфичная обработка ошибок
    if (error.code === 'CONFERENCE_FULL') {
      return res.status(403).json({ message: 'Conference is full' });
    }
    
    res.status(500).json({ message: 'Error joining conference' });
  }
};

// Покидание конференции
const leaveConference = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Проверяем существование конференции
    const conference = await Conference.findById(id);
    if (!conference) {
      return res.status(404).json({ message: 'Conference not found' });
    }

    // Хост не может покинуть свою конференцию
    if (conference.host_id === userId) {
      return res.status(403).json({ 
        message: 'Host cannot leave the conference. Delete it instead.' 
      });
    }

    // Проверяем, является ли пользователь участником
    const isParticipant = await Conference.isParticipant(id, userId);
    if (!isParticipant) {
      return res.status(400).json({ message: 'You are not a participant' });
    }

    // Удаляем пользователя из участников
    await Conference.removeParticipant(id, userId);

    res.json({ message: 'Successfully left conference' });
  } catch (error) {
    console.error('Error leaving conference:', error.message, {
      conferenceId: req.params.id,
      userId: req.user.userId
    });
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
    const isHost = conference.host_id === userId;
    const isParticipant = await Conference.isParticipant(id, userId);
    const isPublic = conference.is_public;

    if (!isHost && !isParticipant && !isPublic) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Получаем участников с информацией о пользователях
    const participants = await Conference.getParticipants(id);
    
    res.json({ 
      participants,
      total: participants.length
    });
  } catch (error) {
    console.error('Error getting conference participants:', error.message, {
      conferenceId: req.params.id,
      userId: req.user.userId
    });
    res.status(500).json({ message: 'Error fetching participants' });
  }
};

// Получение конференций пользователя (где он участник или хост)
const getUserConferences = async (req, res) => {
  try {
    const userId = req.user.userId;
    const role = req.query.role; // 'host', 'participant', or undefined for both

    const conferences = await Conference.findUserConferences(userId, role);

    // Убираем пароли
    const conferencesWithoutPasswords = conferences.map(conf => {
      const { password, ...confData } = conf;
      return confData;
    });

    res.json({ 
      conferences: conferencesWithoutPasswords,
      total: conferencesWithoutPasswords.length
    });
  } catch (error) {
    console.error('Error getting user conferences:', error.message, {
      userId: req.user.userId
    });
    res.status(500).json({ message: 'Error fetching user conferences' });
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
  getConferenceParticipants,
  getUserConferences
};