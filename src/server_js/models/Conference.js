const db = require('../config/database');

const Conference = {
  // Создание новой конференции
  create: async (conferenceData) => {
    const {
      name,
      hostId,
      password,
      maxParticipants,
      isPublic,
      description,
      startTime,
      endTime,
      mode
    } = conferenceData;

    const query = `
      INSERT INTO conferences (
        name,
        host_id,
        password,
        max_participants,
        is_public,
        description,
        start_time,
        end_time,
        mode,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    try {
      const [result] = await db.promise().query(query, [
        name.trim(),
        hostId,
        password || null,
        maxParticipants || null,
        isPublic !== undefined ? isPublic : true,
        description ? description.trim() : null,
        startTime || null,
        endTime || null,
        mode === 'sfu' ? 'sfu' : 'p2p'
      ]);

      // Возвращаем созданную конференцию
      return await Conference.findById(result.insertId);
    } catch (error) {
      console.error('Error creating conference:', error);
      throw error;
    }
  },

  // Получение конференции по ID (без JOIN для оптимизации)
  findById: async (id) => {
    const query = `
      SELECT c.*, 
             u.email as host_email,
             u.username as host_username,
             u.avatar_url as host_avatar
      FROM conferences c
      LEFT JOIN users u ON c.host_id = u.id
      WHERE c.id = ?
    `;

    try {
      const [rows] = await db.promise().query(query, [id]);
      return rows[0] || null;
    } catch (error) {
      console.error('Error finding conference by ID:', error);
      throw error;
    }
  },

  // Получение конференции по названию
  findByName: async (name) => {
    const query = `
      SELECT c.*, 
             u.email as host_email,
             u.username as host_username,
             u.avatar_url as host_avatar
      FROM conferences c
      LEFT JOIN users u ON c.host_id = u.id
      WHERE c.name = ?
    `;

    try {
      const [rows] = await db.promise().query(query, [name]);
      return rows[0] || null;
    } catch (error) {
      console.error('Error finding conference by name:', error);
      throw error;
    }
  },

  // Получение всех конференций (устаревший метод, используй findAllWithParticipantCount)
  findAll: async (limit = 100, offset = 0) => {
    const query = `
      SELECT c.*, 
             u.email as host_email,
             u.username as host_username
      FROM conferences c
      LEFT JOIN users u ON c.host_id = u.id
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;

    try {
      const [rows] = await db.promise().query(query, [parseInt(limit), parseInt(offset)]);
      return rows;
    } catch (error) {
      console.error('Error fetching conferences:', error);
      throw error;
    }
  },

  // Оптимизированное получение конференций с фильтрами
  findAllWithParticipantCount: async ({ limit = 20, offset = 0, userId, filters = {} }) => {
    let whereConditions = ['1=1'];
    let params = [];
    
    // Фильтр по публичности
    if (filters.isPublic !== undefined) {
      whereConditions.push('c.is_public = ?');
      params.push(filters.isPublic ? 1 : 0);
    }
    
    // Поиск по названию и описанию
    if (filters.search) {
      whereConditions.push('(c.name LIKE ? OR c.description LIKE ?)');
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }
    
    // Фильтр по статусу (upcoming, ongoing, ended)
    if (filters.status === 'upcoming') {
      whereConditions.push('c.start_time > NOW()');
    } else if (filters.status === 'ongoing') {
      whereConditions.push('c.start_time <= NOW() AND (c.end_time IS NULL OR c.end_time >= NOW())');
    } else if (filters.status === 'ended') {
      whereConditions.push('c.end_time < NOW()');
    }
    
    const whereClause = whereConditions.join(' AND ');
    
    // Основной запрос с подзапросом для подсчета участников
    const query = `
      SELECT c.*, 
             u.email as host_email,
             u.username as host_username,
             u.avatar_url as host_avatar,
             COALESCE(cm.participant_count, 0) as participant_count
      FROM conferences c
      LEFT JOIN users u ON c.host_id = u.id
      LEFT JOIN (
        SELECT conference_id, COUNT(*) as participant_count
        FROM conference_members
        GROUP BY conference_id
      ) cm ON c.id = cm.conference_id
      WHERE ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    // Запрос для общего количества
    const countQuery = `
      SELECT COUNT(*) as total
      FROM conferences c
      WHERE ${whereClause}
    `;
    
    try {
      const [rows] = await db.promise().query(query, [...params, parseInt(limit), parseInt(offset)]);
      const [countResult] = await db.promise().query(countQuery, params);
      
      return {
        conferences: rows,
        total: countResult[0].total
      };
    } catch (error) {
      console.error('Error fetching conferences with filters:', error);
      throw error;
    }
  },

  // Получение конференций пользователя с ролью
  findUserConferences: async (userId, role = null) => {
    let query;
    let params = [];
    
    if (role === 'host') {
      // Только конференции, где пользователь - хост
      query = `
        SELECT c.*, 
               u.email as host_email,
               u.username as host_username,
               u.avatar_url as host_avatar,
               COALESCE(cm.participant_count, 0) as participant_count,
               1 as is_host,
               0 as is_participant
        FROM conferences c
        LEFT JOIN users u ON c.host_id = u.id
        LEFT JOIN (
          SELECT conference_id, COUNT(*) as participant_count
          FROM conference_members
          GROUP BY conference_id
        ) cm ON c.id = cm.conference_id
        WHERE c.host_id = ?
        ORDER BY c.created_at DESC
      `;
      params = [userId];
      
    } else if (role === 'participant') {
      // Только конференции, где пользователь - участник (но не хост)
      query = `
        SELECT c.*, 
               u.email as host_email,
               u.username as host_username,
               u.avatar_url as host_avatar,
               COALESCE(cm_count.participant_count, 0) as participant_count,
               0 as is_host,
               1 as is_participant,
               cm.joined_at
        FROM conference_members cm
        JOIN conferences c ON cm.conference_id = c.id
        LEFT JOIN users u ON c.host_id = u.id
        LEFT JOIN (
          SELECT conference_id, COUNT(*) as participant_count
          FROM conference_members
          GROUP BY conference_id
        ) cm_count ON c.id = cm_count.conference_id
        WHERE cm.user_id = ? AND c.host_id != ?
        ORDER BY cm.joined_at DESC
      `;
      params = [userId, userId];
      
    } else {
      // Все конференции пользователя (как хост и как участник)
      query = `
        SELECT DISTINCT c.*, 
               u.email as host_email,
               u.username as host_username,
               u.avatar_url as host_avatar,
               COALESCE(cm_count.participant_count, 0) as participant_count,
               CASE WHEN c.host_id = ? THEN 1 ELSE 0 END as is_host,
               CASE WHEN cm.user_id IS NOT NULL THEN 1 ELSE 0 END as is_participant,
               cm.joined_at
        FROM conferences c
        LEFT JOIN conference_members cm ON c.id = cm.conference_id AND cm.user_id = ?
        LEFT JOIN users u ON c.host_id = u.id
        LEFT JOIN (
          SELECT conference_id, COUNT(*) as participant_count
          FROM conference_members
          GROUP BY conference_id
        ) cm_count ON c.id = cm_count.conference_id
        WHERE c.host_id = ? OR cm.user_id = ?
        ORDER BY c.created_at DESC
      `;
      params = [userId, userId, userId, userId];
    }
    
    try {
      const [rows] = await db.promise().query(query, params);
      return rows;
    } catch (error) {
      console.error('Error fetching user conferences:', error);
      throw error;
    }
  },

  // Обновление конференции с возвратом обновленного объекта
  update: async (id, updateData) => {
    // Белый список разрешенных полей
    const allowedFields = {
      'name': 'name',
      'password': 'password',
      'maxParticipants': 'max_participants',
      'isPublic': 'is_public',
      'description': 'description',
      'startTime': 'start_time',
      'endTime': 'end_time',
      'mode': 'mode'
    };

    const fields = [];
    const values = [];

    for (const [camelKey, value] of Object.entries(updateData)) {
      const snakeKey = allowedFields[camelKey];
      
      if (snakeKey && value !== undefined) {
        fields.push(`${snakeKey} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      // Нет полей для обновления, просто возвращаем текущую конференцию
      return await Conference.findById(id);
    }

    fields.push('updated_at = NOW()');
    values.push(id);

    const query = `UPDATE conferences SET ${fields.join(', ')} WHERE id = ?`;

    try {
      await db.promise().query(query, values);
      // Возвращаем обновленную конференцию
      return await Conference.findById(id);
    } catch (error) {
      console.error('Error updating conference:', error);
      throw error;
    }
  },

  // Удаление конференции
  delete: async (id) => {
    // Каскадное удаление участников происходит через FK constraint
    const query = 'DELETE FROM conferences WHERE id = ?';

    try {
      const [result] = await db.promise().query(query, [id]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error deleting conference:', error);
      throw error;
    }
  },

  // Проверка существования конференции
  exists: async (id) => {
    const query = 'SELECT 1 FROM conferences WHERE id = ? LIMIT 1';

    try {
      const [rows] = await db.promise().query(query, [id]);
      return rows.length > 0;
    } catch (error) {
      console.error('Error checking conference existence:', error);
      throw error;
    }
  },

  // Проверка, является ли пользователь участником
  isParticipant: async (conferenceId, userId) => {
    const query = 'SELECT 1 FROM conference_members WHERE conference_id = ? AND user_id = ? LIMIT 1';

    try {
      const [rows] = await db.promise().query(query, [conferenceId, userId]);
      return rows.length > 0;
    } catch (error) {
      console.error('Error checking participant status:', error);
      throw error;
    }
  },

  // Добавление участника в конференцию с проверкой лимита (thread-safe)
  addParticipant: async (conferenceId, userId) => {
    const connection = await db.promise().getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Блокируем строку конференции для предотвращения race condition
      const [conferences] = await connection.query(
        'SELECT id, max_participants FROM conferences WHERE id = ? FOR UPDATE',
        [conferenceId]
      );
      
      if (!conferences[0]) {
        await connection.rollback();
        return { 
          success: false, 
          message: 'Conference not found' 
        };
      }
      
      const maxParticipants = conferences[0].max_participants;
      
      // Проверяем, не является ли пользователь уже участником
      const [existing] = await connection.query(
        'SELECT 1 FROM conference_members WHERE conference_id = ? AND user_id = ? LIMIT 1',
        [conferenceId, userId]
      );
      
      if (existing.length > 0) {
        await connection.rollback();
        return { 
          success: false, 
          message: 'Already a participant',
          alreadyJoined: true 
        };
      }
      
      // Проверяем текущее количество участников
      if (maxParticipants !== null) {
        const [countResult] = await connection.query(
          'SELECT COUNT(*) as count FROM conference_members WHERE conference_id = ?',
          [conferenceId]
        );
        
        const currentCount = countResult[0].count;
        
        if (currentCount >= maxParticipants) {
          await connection.rollback();
          return { 
            success: false, 
            message: 'Conference is full',
            isFull: true 
          };
        }
      }
      
      // Добавляем участника
      await connection.query(
        'INSERT INTO conference_members (conference_id, user_id, joined_at) VALUES (?, ?, NOW())',
        [conferenceId, userId]
      );
      
      await connection.commit();
      return { success: true };
      
    } catch (error) {
      await connection.rollback();
      console.error('Error adding participant:', error);
      throw error;
    } finally {
      connection.release();
    }
  },

  // Удаление участника из конференции
  removeParticipant: async (conferenceId, userId) => {
    const query = 'DELETE FROM conference_members WHERE conference_id = ? AND user_id = ?';

    try {
      const [result] = await db.promise().query(query, [conferenceId, userId]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error removing participant:', error);
      throw error;
    }
  },

  // Получение участников конференции с информацией о пользователях
  getParticipants: async (conferenceId) => {
    const query = `
      SELECT 
        u.id as user_id,
        u.email,
        u.username,
        u.avatar_url,
        cm.joined_at,
        CASE WHEN c.host_id = u.id THEN 1 ELSE 0 END as is_host
      FROM conference_members cm
      JOIN users u ON cm.user_id = u.id
      JOIN conferences c ON cm.conference_id = c.id
      WHERE cm.conference_id = ?
      ORDER BY 
        CASE WHEN c.host_id = u.id THEN 0 ELSE 1 END,
        cm.joined_at ASC
    `;

    try {
      const [rows] = await db.promise().query(query, [conferenceId]);
      return rows;
    } catch (error) {
      console.error('Error fetching participants:', error);
      throw error;
    }
  },

  // Получение количества участников
  getParticipantCount: async (conferenceId) => {
    const query = 'SELECT COUNT(*) as count FROM conference_members WHERE conference_id = ?';

    try {
      const [rows] = await db.promise().query(query, [conferenceId]);
      return rows[0].count || 0;
    } catch (error) {
      console.error('Error getting participant count:', error);
      throw error;
    }
  },

  // Проверка доступа к конференции (упрощенная версия)
  hasAccess: async (conferenceId, userId, password = null) => {
    const bcrypt = require('bcrypt');
    const query = 'SELECT * FROM conferences WHERE id = ?';

    try {
      const [rows] = await db.promise().query(query, [conferenceId]);
      const conference = rows[0];

      if (!conference) return false;

      // Хост всегда имеет доступ
      if (conference.host_id === userId) return true;

      // Проверяем, является ли пользователь участником
      const isParticipant = await Conference.isParticipant(conferenceId, userId);
      if (isParticipant) return true;

      // Только публичные доступны без приглашения
      if (!conference.is_public) return false;

      // Публичная конференция без пароля
      if (!conference.password) return true;

      // Публичная конференция с паролем — сверяем bcrypt-хеш
      if (!password) return false;
      return await bcrypt.compare(password, conference.password);
    } catch (error) {
      console.error('Error checking conference access:', error);
      throw error;
    }
  },

  // Получение активных конференций (ongoing)
  getActiveConferences: async (limit = 20, offset = 0) => {
    const query = `
      SELECT c.*, 
             u.email as host_email,
             u.username as host_username,
             u.avatar_url as host_avatar,
             COALESCE(cm.participant_count, 0) as participant_count
      FROM conferences c
      LEFT JOIN users u ON c.host_id = u.id
      LEFT JOIN (
        SELECT conference_id, COUNT(*) as participant_count
        FROM conference_members
        GROUP BY conference_id
      ) cm ON c.id = cm.conference_id
      WHERE c.is_public = 1
        AND (c.start_time IS NULL OR c.start_time <= NOW())
        AND (c.end_time IS NULL OR c.end_time >= NOW())
      ORDER BY cm.participant_count DESC, c.created_at DESC
      LIMIT ? OFFSET ?
    `;

    try {
      const [rows] = await db.promise().query(query, [parseInt(limit), parseInt(offset)]);
      return rows;
    } catch (error) {
      console.error('Error fetching active conferences:', error);
      throw error;
    }
  },

  // Массовое удаление участников (полезно для очистки)
  removeAllParticipants: async (conferenceId) => {
    const query = 'DELETE FROM conference_members WHERE conference_id = ?';

    try {
      const [result] = await db.promise().query(query, [conferenceId]);
      return result.affectedRows;
    } catch (error) {
      console.error('Error removing all participants:', error);
      throw error;
    }
  },

  // Получение статистики конференции
  getConferenceStats: async (conferenceId) => {
    const query = `
      SELECT 
        c.id,
        c.name,
        c.created_at,
        c.max_participants,
        COUNT(cm.user_id) as current_participants,
        CASE 
          WHEN c.max_participants IS NOT NULL 
          THEN (COUNT(cm.user_id) * 100.0 / c.max_participants)
          ELSE NULL 
        END as occupancy_rate,
        MIN(cm.joined_at) as first_join,
        MAX(cm.joined_at) as last_join
      FROM conferences c
      LEFT JOIN conference_members cm ON c.id = cm.conference_id
      WHERE c.id = ?
      GROUP BY c.id
    `;

    try {
      const [rows] = await db.promise().query(query, [conferenceId]);
      return rows[0] || null;
    } catch (error) {
      console.error('Error getting conference stats:', error);
      throw error;
    }
  }
};

module.exports = Conference;