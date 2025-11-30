import os
import sys
from celery import Celery
import logging

logger = logging.getLogger(__name__)

# Detect Windows platform
IS_WINDOWS = sys.platform == 'win32'

CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL')  # e.g., amqp://user:pass@rabbitmq:5672//
CELERY_RESULT_BACKEND = os.getenv('CELERY_RESULT_BACKEND') or os.getenv('REDIS_URL') or None

if not CELERY_BROKER_URL:
	logger.warning('CELERY_BROKER_URL is not set. Celery tasks will not work without a broker.')
	logger.warning('Please set CELERY_BROKER_URL in your .env file (e.g., CELERY_BROKER_URL=redis://localhost:6379/0)')
	# Don't raise - allow server to start, but tasks won't work
	CELERY_BROKER_URL = 'redis://localhost:6379/0'  # Default fallback

if not CELERY_RESULT_BACKEND:
	logger.warning('CELERY_RESULT_BACKEND is not set. Task status tracking will be disabled.')
	logger.warning('Please set CELERY_RESULT_BACKEND in your .env file (e.g., CELERY_RESULT_BACKEND=redis://localhost:6379/0)')
	logger.warning('Setting default to redis://localhost:6379/0 - ensure Redis is running!')
	CELERY_RESULT_BACKEND = 'redis://localhost:6379/0'  # Default fallback

celery_app = Celery('brandmonitor_orchestration',
	broker=CELERY_BROKER_URL,
	backend=CELERY_RESULT_BACKEND,
	include=['tasks']  # Import tasks module to register all tasks
)

# Basic config; tune as needed
# On Windows, MUST use 'solo' pool (no fork support)
worker_pool = os.getenv('CELERY_WORKER_POOL', 'solo' if IS_WINDOWS else 'prefork')
if IS_WINDOWS and worker_pool != 'solo':
	logger.warning(f'Windows detected: Forcing worker pool to "solo" (was: {worker_pool})')
	logger.warning('Windows does not support fork(). Use --pool=solo when starting the worker.')
	worker_pool = 'solo'

celery_app.conf.update(
	result_expires=3600,
	worker_prefetch_multiplier=1,
	worker_pool=worker_pool,  # Set default pool for Windows
	broker_connection_retry_on_startup=True,
	result_backend_transport_options={
		'retry_policy': {
			'max_retries': 3,
			'interval_start': 0,
			'interval_step': 0.2,
			'interval_max': 0.2
		}
	}
)

if IS_WINDOWS:
	logger.info(f'Windows detected: Worker pool set to "{worker_pool}". Always use --pool=solo when starting workers.')

# Log configuration
logger.info(f"Celery configured with broker: {CELERY_BROKER_URL}")
logger.info(f"Celery configured with result backend: {CELERY_RESULT_BACKEND}")

# Import tasks to register them with Celery
try:
	import tasks  # noqa: F401 - This ensures tasks are registered
	logger.info("Tasks module imported successfully")
except ImportError as e:
	logger.warning(f"Could not import tasks module: {e}. Tasks may not be registered.")



