# Задание 1. HTTP-прокси и работа с простым API

DEPRICATED, api изменился, новые запросы в п.3

# 2. HTTPS-проксирование

### 0. Прокси запрос на example.com через локальный прокси

```bash
curl -x http://127.0.0.1:8080 http://example.com
```

### 1. Прокси запрос на mail.ru

```bash
curl -x http://127.0.0.1:8080 https://mail.ru
```

### 2. Прокси запрос на github.com

```bash
curl -x http://127.0.0.1:8080 https://github.com
```

# 3. Сохранение запросов в MongoDB

### 1. Все запросы

```bash
curl http://127.0.0.1:8000/requests
```

### 2. Просмотр одного запроса

```bash
curl http://127.0.0.1:8000/requests/6805594257df8e98eddedf38
```

### 3. Повтор запроса

```bash
curl -X POST http://localhost:8000/repeat/6805594257df8e98eddedf38
```

### 4. Посмотреть id запросов в Монго

```bash
mongosh
use proxy_logs

db.requestlogs.find({}, {
  _id: 1,
  "request.method": 1,
  "request.headers.host": 1,
  "request.path": 1,
  "timestamp": 1
}).sort({ _id: -1 }).limit(10).pretty()
```
