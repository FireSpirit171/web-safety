#!/bin/sh

# Папка для хранения сертификатов
CERTS_DIR="./certs"
mkdir -p $CERTS_DIR

# Генерация корневого сертификата, если он не существует
if [ ! -f ca.key ]; then
    echo "Генерируем корневой сертификат..."
    openssl genrsa -out ca.key 2048
    openssl req -new -x509 -days 3650 -key ca.key -out ca.crt -subj "/CN=yngwie proxy CA"
    if [ $? -ne 0 ]; then
        echo "Ошибка при генерации корневого сертификата"
        exit 1
    fi
fi

# Генерация серверного ключа, если он не существует
if [ ! -f cert.key ]; then
    echo "Генерируем серверный ключ..."
    openssl genrsa -out cert.key 2048
    if [ $? -ne 0 ]; then
        echo "Ошибка при генерации серверного ключа"
        exit 1
    fi
fi

# Если передан домен, генерируем сертификат для него
if [ $# -eq 2 ]; then
    DOMAIN=$1
    SERIAL=$2

    echo "Генерируем сертификат для $DOMAIN..."

    openssl req -new -key cert.key -subj "/CN=$DOMAIN" -sha256 | \
        openssl x509 -req -days 365 -CA ca.crt -CAkey ca.key -set_serial "$SERIAL" -out "$CERTS_DIR/$DOMAIN.crt"
    
    if [ $? -ne 0 ]; then
        echo "Ошибка при генерации сертификата для $DOMAIN"
        exit 1
    fi

    echo "Сертификат для $DOMAIN создан: $CERTS_DIR/$DOMAIN.crt"
else
    echo "Не передан домен для сертификата"
    exit 1
fi
