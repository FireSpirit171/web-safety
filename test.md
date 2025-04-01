# 1. Команды для проксирования и работы с API

### 1. Прокси запрос на example.com через локальный прокси

```bash
curl -x http://127.0.0.1:8080 http://example.com
```

### 2. Получить список всех запросов через API

```bash
curl http://127.0.0.1:8000/requests
```

### 3. Получить запрос по ID

```bash
curl http://127.0.0.1:8000/requests/1
```

### 4. Повторить запрос по ID

```bash
curl -X POST http://127.0.0.1:8000/repeat/1
```

### 5. Сканировать запрос по ID

```bash
curl -X POST http://127.0.0.1:8000/scan/0
```

# 2. HTTPS-проксирование

### 1. Прокси запрос на mail.ru

```bash
curl -x http://127.0.0.1:8080 https://mail.ru
```

### 2. Прокси запрос на github.com

```bash
curl -x http://127.0.0.1:8080 https://github.com
```
