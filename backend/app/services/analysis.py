import logging
from typing import Optional, Tuple

logger = logging.getLogger(__name__)


class AnalysisService:
    """
    Service for additional analysis logic and response filtering.
    """

    def __init__(self):
        self.last_response: Optional[str] = None
        self.repeat_count: int = 0
        self.max_repeats: int = 3

    def should_speak(self, current_response: str) -> bool:
        """
        Determine if the response should be spoken.
        Filters repeated responses to avoid annoying the user.
        """
        if not current_response:
            return False

        # Always speak error messages
        if current_response.startswith("Error"):
            return True

        # Check for repeated responses
        if current_response == self.last_response:
            self.repeat_count += 1
            # Only repeat "Libre" up to max_repeats times
            if "libre" in current_response.lower():
                if self.repeat_count > self.max_repeats:
                    return False
        else:
            self.repeat_count = 0
            self.last_response = current_response

        return True

    def parse_direction(self, response: str) -> Tuple[Optional[str], Optional[float]]:
        """
        Parse direction and distance from response text.
        Returns (direction, distance_meters)
        """
        response_lower = response.lower()

        # Parse direction
        direction = None
        if "izquierda" in response_lower:
            direction = "left"
        elif "derecha" in response_lower:
            direction = "right"
        elif "frente" in response_lower or "adelante" in response_lower:
            direction = "front"
        elif "atrás" in response_lower:
            direction = "back"

        # Parse distance (simple extraction)
        distance = None
        import re
        distance_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:metros?|m)", response_lower)
        if distance_match:
            distance = float(distance_match.group(1))

        return direction, distance

    def is_obstacle_detected(self, response: str) -> bool:
        """
        Check if an obstacle was detected in the response.
        """
        response_lower = response.lower()

        # "Libre" means no obstacle
        if response_lower.strip() == "libre":
            return False

        # Keywords that indicate obstacles
        obstacle_keywords = [
            "escalón", "persona", "objeto", "pared", "puerta",
            "obstáculo", "hueco", "vehículo", "silla", "mesa",
            "cuidado", "para", "stop", "alto"
        ]

        return any(keyword in response_lower for keyword in obstacle_keywords)

    def get_urgency_level(self, response: str) -> int:
        """
        Determine urgency level (1-3) based on response.
        1 = Low (informational)
        2 = Medium (caution)
        3 = High (immediate danger)
        """
        response_lower = response.lower()

        # High urgency keywords
        high_urgency = ["para", "stop", "alto", "cuidado", "peligro", "hueco"]
        if any(keyword in response_lower for keyword in high_urgency):
            return 3

        # Medium urgency (obstacles detected)
        if self.is_obstacle_detected(response):
            return 2

        # Low urgency (clear path)
        return 1
