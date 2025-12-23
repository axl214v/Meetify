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
      endTime 
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
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    try {
      const [result] = await db.promise().query(query, [
        name,
        hostId,
        password,
        maxParticipants || 100,
        isPublic || true,
        description || '',
        startTime || null,
        endTime || null
      ]);

      return {
        id: result.insertId,
        ...conferenceData,
        created_at: new Date(),
        updated_at: new Date()
      };
    } catch (error) {
      console.error('Error creating conference:', error);
      throw error;
    }
  },

  // Получение конференции по ID
  findById: async (id) => {
    const query = `
      SELECT c.*, 
             u.email as host_email,
             COUNT(cm.user_id) as participant_count
      FROM conferences c
      LEFT JOIN users u ON c.host_id = u.id
      LEFT JOIN conference_members cm ON c.id = cm.conference_id
      WHERE c.id = ?
      GROUP BY c.id
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
             COUNT(cm.user_id) as participant_count
      FROM conferences c
      LEFT JOIN users u ON c.host_id = u.id
      LEFT JOIN conference_members cm ON c.id = cm.conference_id
      WHERE c.name = ?
      GROUP BY c.id
    `;

    try {
      const [rows] = await db.promise().query(query, [name]);
      return rows[0] || null;
    } catch (error) {
      console.error('Error finding conference by name:', error);
      throw error;
    }
  },

  // Получение всех конференций
  findAll: async (limit = 100, offset = 0) => {
    const query = `
      SELECT c.*, 
             u.email as host_email,
             COUNT(cm.user_id) as participant_count
      FROM conferences c
      LEFT JOIN users u ON c.host_id = u.id
      LEFT JOIN conference_members cm ON c.id = cm.conference_id
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;

    try {
      const [rows] = await db.promise().query(query, [limit, offset]);
      return rows;
    } catch (error) {
      console.error('Error fetching conferences:', error);
      throw error;
    }
  },

  // Получение конференций пользователя
  findByUserId: async (userId, limit = 100, offset = 0) => {
    const query = `
      SELECT c.*, 
             u.email as host_email,
             COUNT(cm.user_id) as participant_count
      FROM conferences c
      LEFT JOIN users u ON c.host_id = u.id
      LEFT JOIN conference_members cm ON c.id = cm.conference_id
      WHERE c.host_id = ? OR cm.user_id = ?
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;

    try {
      const [rows] = await db.promise().query(query, [userId, userId, limit, offset]);
      return rows;
    } catch (error) {
      console.error('Error fetching user conferences:', error);
      throw error;
    }
  },

  // Обновление конференции
  update: async (id, updateData) => {
    const { 
      name, 
      password, 
      maxParticipants, 
      isPublic,
      description,
      startTime,
      endTime 
    } = updateData;

    const fields = [];
    const values = [];

    if (name !== undefined) {
      fields.push('name = ?');
      values.push(name);
    }
    if (password !== undefined) {
      fields.push('password = ?');
      values.push(password);
    }
    if (maxParticipants !== undefined) {
      fields.push('max_participants = ?');
      values.push(maxParticipants);
    }
    if (isPublic !== undefined) {
      fields.push('is_public = ?');
      values.push(isPublic);
    }
    if (description !== undefined) {
      fields.push('description = ?');
      values.push(description);
    }
    if (startTime !== undefined) {
      fields.push('start_time = ?');
      values.push(startTime);
    }
    if (endTime !== undefined) {
      fields.push('end_time = ?');
      values.push(endTime);
    }

    if (fields.length === 0) {
      return null;
    }

    fields.push('updated_at = NOW()');
    values.push(id);

    const query = `UPDATE conferences SET ${fields.join(', ')} WHERE id = ?`;

    try {
      const [result] = await db.promise().query(query, values);
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating conference:', error);
      throw error;
    }
  },

  // Удаление конференции
  delete: async (id) => {
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
    const query = 'SELECT id FROM conferences WHERE id = ?';

    try {
      const [rows] = await db.promise().query(query, [id]);
      return rows.length > 0;
    } catch (error) {
      console.error('Error checking conference existence:', error);
      throw error;
    }
  },

  // Добавление участника в конференцию
  addParticipant: async (conferenceId, userId) => {
    const query = `
      INSERT IGNORE INTO conference_members (conference_id, user_id, joined_at)
      VALUES (?, ?, NOW())
    `;

    try {
      const [result] = await db.promise().query(query, [conferenceId, userId]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error adding participant:', error);
      throw error;
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

  // Получение участников конференции
  getParticipants: async (conferenceId) => {
    const query = `
      SELECT cm.*, u.email, u.id as user_id
      FROM conference_members cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.conference_id = ?
      ORDER BY cm.joined_at DESC
    `;

    try {
      const [rows] = await db.promise().query(query, [conferenceId]);
      return rows;
    } catch (error) {
      console.error('Error fetching participants:', error);
      throw error;
    }
  },

  // Проверка доступа к конференции
  hasAccess: async (conferenceId, userId, password = null) => {
    const query = `
      SELECT c.*, 
             CASE 
               WHEN c.password IS NULL OR c.password = ? THEN 1 
               ELSE 0 
             END as has_password_access
      FROM conferences c
      WHERE c.id = ? AND (c.is_public = 1 OR c.host_id = ?)
    `;

    try {
      const [rows] = await db.promise().query(query, [password, conferenceId, userId]);
      const conference = rows[0];
      
      if (!conference) {
        return false;
      }

      // Если конференция приватная и нет пароля, проверяем, является ли пользователь участником
      if (!conference.is_public && !password && conference.host_id !== userId) {
        const participantQuery = 'SELECT 1 FROM conference_members WHERE conference_id = ? AND user_id = ?';
        const [participantRows] = await db.promise().query(participantQuery, [conferenceId, userId]);
        return participantRows.length > 0;
      }

      return true;
    } catch (error) {
      console.error('Error checking conference access:', error);
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
  }
};

module.exports = Conference;