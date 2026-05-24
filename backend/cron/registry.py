from collections.abc import Callable
from dataclasses import dataclass


@dataclass
class CronJob:
    id: str
    cron: str
    func: Callable
    use_local_timezone: bool = False
