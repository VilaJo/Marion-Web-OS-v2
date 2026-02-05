"""
Marion Web OS - Module de chiffrement
Utilise Fernet (AES-128-CBC) avec derivation de cle PBKDF2
"""

import os
import json
import base64
import hashlib
import secrets
from pathlib import Path
from typing import Optional, Any

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

# Constantes
SALT_LENGTH = 16
ITERATIONS = 480000  # OWASP recommande 600k pour SHA256, 480k est un bon compromis


def generate_salt() -> bytes:
    """Genere un salt aleatoire cryptographiquement securise"""
    return secrets.token_bytes(SALT_LENGTH)


def derive_key(password: str, salt: bytes) -> bytes:
    """
    Derive une cle Fernet depuis le mot de passe et le salt.
    Utilise PBKDF2-HMAC-SHA256 avec 480000 iterations.
    """
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=ITERATIONS,
    )
    return base64.urlsafe_b64encode(kdf.derive(password.encode()))


def hash_password(password: str, salt: bytes) -> str:
    """
    Hash le mot de passe pour verification.
    Retourne le hash en base64.
    """
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=ITERATIONS,
    )
    return base64.b64encode(kdf.derive(password.encode())).decode()


def verify_password(password: str, salt: bytes, stored_hash: str) -> bool:
    """Verifie si le mot de passe correspond au hash stocke"""
    try:
        computed_hash = hash_password(password, salt)
        return secrets.compare_digest(computed_hash, stored_hash)
    except Exception:
        return False


def encrypt_data(data: Any, password: str, salt: bytes) -> bytes:
    """
    Chiffre des donnees (dict, list, str) en bytes.
    Le salt doit etre stocke separement pour le dechiffrement.
    """
    key = derive_key(password, salt)
    fernet = Fernet(key)
    
    # Convertir en JSON si necessaire
    if isinstance(data, (dict, list)):
        json_data = json.dumps(data, ensure_ascii=False)
    else:
        json_data = str(data)
    
    return fernet.encrypt(json_data.encode('utf-8'))


def decrypt_data(encrypted: bytes, password: str, salt: bytes) -> Any:
    """
    Dechiffre des donnees.
    Retourne les donnees originales (dict, list, ou str).
    Leve InvalidToken si le mot de passe est incorrect.
    """
    key = derive_key(password, salt)
    fernet = Fernet(key)
    
    decrypted = fernet.decrypt(encrypted).decode('utf-8')
    
    # Essayer de parser comme JSON
    try:
        return json.loads(decrypted)
    except json.JSONDecodeError:
        return decrypted


def encrypt_to_file(data: Any, password: str, filepath: Path) -> bool:
    """
    Chiffre des donnees et les sauvegarde dans un fichier.
    Le format du fichier: salt (16 bytes) + donnees chiffrees
    """
    try:
        salt = generate_salt()
        encrypted = encrypt_data(data, password, salt)
        
        with open(filepath, 'wb') as f:
            f.write(salt + encrypted)
        
        return True
    except Exception as e:
        print(f"Erreur chiffrement: {e}")
        return False


def decrypt_from_file(filepath: Path, password: str) -> Optional[Any]:
    """
    Lit et dechiffre un fichier chiffre.
    Retourne None si le fichier n'existe pas ou si le dechiffrement echoue.
    """
    if not filepath.exists():
        return None
    
    try:
        with open(filepath, 'rb') as f:
            content = f.read()
        
        salt = content[:SALT_LENGTH]
        encrypted = content[SALT_LENGTH:]
        
        return decrypt_data(encrypted, password, salt)
    except InvalidToken:
        raise ValueError("Mot de passe incorrect")
    except Exception as e:
        print(f"Erreur dechiffrement: {e}")
        return None


def encrypt_field(value: Any, password: str, salt: bytes) -> str:
    """
    Chiffre un champ individuel et retourne une string base64.
    Utile pour chiffrer des champs specifiques dans un JSON.
    """
    encrypted = encrypt_data(value, password, salt)
    return base64.b64encode(encrypted).decode()


def decrypt_field(encrypted_b64: str, password: str, salt: bytes) -> Any:
    """
    Dechiffre un champ individuel depuis une string base64.
    """
    encrypted = base64.b64decode(encrypted_b64)
    return decrypt_data(encrypted, password, salt)


def is_encrypted_field(value: Any) -> bool:
    """
    Detecte si une valeur est un champ chiffre (string base64 Fernet).
    Les tokens Fernet commencent par 'gAAAAA'.
    """
    if not isinstance(value, str):
        return False
    try:
        decoded = base64.b64decode(value)
        return decoded.startswith(b'gAAAAA') or len(decoded) > 50
    except Exception:
        return False


# --- Migration helpers ---

def migrate_json_to_encrypted(json_path: Path, enc_path: Path, password: str) -> bool:
    """
    Migre un fichier JSON non chiffre vers un fichier chiffre.
    """
    if not json_path.exists():
        return False
    
    try:
        with open(json_path, 'r') as f:
            data = json.load(f)
        
        if encrypt_to_file(data, password, enc_path):
            # Supprimer l'ancien fichier non chiffre
            json_path.unlink()
            return True
        return False
    except Exception as e:
        print(f"Erreur migration: {e}")
        return False


def encrypt_sensitive_fields(data: dict, password: str, salt: bytes, 
                             sensitive_keys: list[str]) -> dict:
    """
    Chiffre les champs sensibles dans un dictionnaire.
    Ajoute le prefixe '_encrypted_' aux cles chiffrees.
    """
    result = data.copy()
    
    for key in sensitive_keys:
        if key in result and result[key]:
            encrypted_value = encrypt_field(result[key], password, salt)
            result[f'_encrypted_{key}'] = encrypted_value
            result[key] = "[CHIFFRE]"  # Placeholder visible
    
    return result


def decrypt_sensitive_fields(data: dict, password: str, salt: bytes,
                             sensitive_keys: list[str]) -> dict:
    """
    Dechiffre les champs sensibles dans un dictionnaire.
    """
    result = data.copy()
    
    for key in sensitive_keys:
        encrypted_key = f'_encrypted_{key}'
        if encrypted_key in result:
            try:
                result[key] = decrypt_field(result[encrypted_key], password, salt)
                del result[encrypted_key]
            except Exception:
                pass  # Garder le placeholder si dechiffrement echoue
    
    return result
