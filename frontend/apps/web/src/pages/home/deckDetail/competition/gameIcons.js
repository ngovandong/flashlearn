import SportsScoreIcon from "@mui/icons-material/SportsScore";
import GpsFixedIcon from "@mui/icons-material/GpsFixed";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import ViewDayIcon from "@mui/icons-material/ViewDay";
import ImageSearchIcon from "@mui/icons-material/ImageSearch";
import ShortTextIcon from "@mui/icons-material/ShortText";
import BoltIcon from "@mui/icons-material/Bolt";

// Maps the platform-agnostic icon hint from @flashlearn/core to a web MUI icon.
export const GAME_ICONS = {
  race: SportsScoreIcon,
  blaster: GpsFixedIcon,
  tug: CompareArrowsIcon,
  tower: ViewDayIcon,
  picture: ImageSearchIcon,
  sentence: ShortTextIcon,
  buzzer: BoltIcon,
};

// Which availability flag + message applies to each requirement.
export const REQUIREMENT_INFO = {
  none: { flag: "mcq", reason: "Add at least 4 terms to play." },
  synAnt: {
    flag: "synAnt",
    reason: "This deck needs terms with synonyms or antonyms.",
  },
  images: {
    flag: "images",
    reason: "This deck needs at least 4 terms with images.",
  },
  examples: {
    flag: "examples",
    reason: "This deck needs terms with example sentences.",
  },
};
