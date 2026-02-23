FROM node:18-alpine

# Создание директории приложения
RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app

WORKDIR /home/node/app

# Копирование зависимостей
COPY package*.json ./

# Переключение на пользователя node
USER node

# Установка зависимостей
RUN npm ci --only=production

# Копирование исходного кода
COPY --chown=node:node . .

# Открытие порта
EXPOSE 3000

# Команда запуска
CMD [ "node", "index.js" ]