import AccountTreeIcon from "@mui/icons-material/AccountTree";
import ArticleIcon from "@mui/icons-material/Article";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import BoltIcon from "@mui/icons-material/Bolt";
import CallMergeIcon from "@mui/icons-material/CallMerge";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import HelpOutlineIcon from "@mui/icons-material/InfoOutlined";
import HistoryIcon from "@mui/icons-material/History";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import LinkIcon from "@mui/icons-material/Link";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import PersonIcon from "@mui/icons-material/Person";
import PlaceIcon from "@mui/icons-material/Place";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import SortIcon from "@mui/icons-material/Sort";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import TagIcon from "@mui/icons-material/Tag";
import TodayIcon from "@mui/icons-material/Today";

// Maps a section title to a themed icon so the catalog/course reads as a set of
// distinct topics rather than one long, uniform list. First match wins.
const RULES = [
  [/present perfect/i, DoneAllIcon],
  [/present/i, TodayIcon],
  [/past/i, HistoryIcon],
  [/passive/i, SwapHorizIcon],
  [/verb/i, BoltIcon],
  [/future/i, RocketLaunchIcon],
  [/modal/i, LightbulbIcon],
  [/question/i, HelpOutlineIcon],
  [/report/i, FormatQuoteIcon],
  [/-ing|to…|infinitive/i, LinkIcon],
  [/noun|article/i, ArticleIcon],
  [/determiner|quantif/i, TagIcon],
  [/pronoun|possess/i, PersonIcon],
  [/adjective|adverb/i, AutoAwesomeIcon],
  [/word order/i, SortIcon],
  [/conjunction|clause/i, AccountTreeIcon],
  [/preposition/i, PlaceIcon],
  [/phrasal/i, CallMergeIcon],
];

export function sectionIcon(title) {
  const t = title || "";
  for (const [re, Icon] of RULES) if (re.test(t)) return Icon;
  return MenuBookIcon;
}

// A stable hue-rotation (in degrees) applied over the theme's brand gradient so
// each section gets its own on-theme tint without hardcoding off-palette colors.
// A curated spread keeps every tint pleasant in both light and dark mode.
const HUES = [0, 28, 210, 150, 260, 320, 96, 180, 55, 300];

export function sectionHue(index) {
  return HUES[((index % HUES.length) + HUES.length) % HUES.length];
}
