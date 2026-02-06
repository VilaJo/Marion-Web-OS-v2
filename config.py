"""
Marion Web OS - Configuration
Multi-environment configuration management
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')
load_dotenv('.env')


class Config:
    """Base configuration"""
    
    # Application
    APP_NAME = os.getenv('APP_NAME', 'Marion Web OS')
    APP_VERSION = '2.4.0'
    DEBUG = os.getenv('DEBUG', 'False').lower() in ('true', '1', 'yes')
    
    # Security
    SECRET_KEY = os.getenv('SECRET_KEY', os.getenv('FLASK_SECRET_KEY'))
    if not SECRET_KEY:
        # Generate a stable secret key based on machine ID
        import hashlib
        machine_id = str(Path.home()) + os.getenv('USER', 'marion')
        SECRET_KEY = hashlib.sha256(machine_id.encode()).hexdigest()
    
    SESSION_DURATION_HOURS = int(os.getenv('SESSION_DURATION_HOURS', '8'))
    MAX_LOGIN_ATTEMPTS = int(os.getenv('MAX_LOGIN_ATTEMPTS', '10'))
    RATE_LIMIT_WINDOW_SECONDS = int(os.getenv('RATE_LIMIT_WINDOW_SECONDS', '60'))
    
    # Database
    DATABASE_URL = os.getenv('DATABASE_URL', '')
    if not DATABASE_URL:
        db_folder = Path.home() / "Desktop" / "Marion Web OS Database"
        DATABASE_URL = f"sqlite:///{db_folder / 'marion.db'}"
    
    # Paths
    USER_HOME = Path.home()
    DATA_PATH = Path(os.getenv('DATA_PATH', str(USER_HOME / "Desktop" / "Marion Web OS Database")))
    STATIC_FOLDER = os.getenv('STATIC_FOLDER', '.dist')
    
    # API Keys
    GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
    GITHUB_TOKEN = os.getenv('GITHUB_TOKEN', '')
    
    # Google OAuth
    GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID', '')
    GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET', '')
    GOOGLE_REDIRECT_URI = os.getenv('GOOGLE_REDIRECT_URI', 'http://127.0.0.1:5003/api/oauth/google/callback')
    GOOGLE_SCOPES = os.getenv('GOOGLE_SCOPES', 
        'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/calendar')
    
    # GitHub
    GITHUB_REPO_OWNER = os.getenv('GITHUB_REPO_OWNER', 'VilaJo')
    GITHUB_REPO_NAME = os.getenv('GITHUB_REPO_NAME', 'Marion-Web-OS-v2')
    
    # CORS
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', 'http://127.0.0.1:5003,http://localhost:5003').split(',')
    
    # Email (SMTP)
    SMTP_HOST = os.getenv('SMTP_HOST', '')
    SMTP_PORT = int(os.getenv('SMTP_PORT', '587'))
    SMTP_USER = os.getenv('SMTP_USER', '')
    SMTP_PASSWORD = os.getenv('SMTP_PASSWORD', '')
    SMTP_FROM_EMAIL = os.getenv('SMTP_FROM_EMAIL', '')
    SMTP_FROM_NAME = os.getenv('SMTP_FROM_NAME', 'Marion Web OS')
    
    # Server
    HOST = os.getenv('HOST', '127.0.0.1')
    PORT = int(os.getenv('PORT', '5003'))
    
    @classmethod
    def ensure_data_path(cls):
        """Ensure data directory exists"""
        cls.DATA_PATH.mkdir(parents=True, exist_ok=True)
        return cls.DATA_PATH


class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    

class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    
    # In production, SECRET_KEY must be set explicitly
    @classmethod
    def validate(cls):
        if not os.getenv('SECRET_KEY'):
            raise ValueError("SECRET_KEY must be set in production!")
        if not cls.GEMINI_API_KEY:
            print("Warning: GEMINI_API_KEY not set - Franck chatbot will not work")


class TestingConfig(Config):
    """Testing configuration"""
    DEBUG = True
    TESTING = True
    DATABASE_URL = 'sqlite:///:memory:'


# Configuration mapping
config_map = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}


def get_config(env: str = None) -> Config:
    """Get configuration for the specified environment"""
    if env is None:
        env = os.getenv('FLASK_ENV', os.getenv('ENV', 'development'))
    
    config_class = config_map.get(env, DevelopmentConfig)
    return config_class


# Singleton instance
_config = None

def get_current_config() -> Config:
    """Get the current configuration instance"""
    global _config
    if _config is None:
        _config = get_config()
    return _config
