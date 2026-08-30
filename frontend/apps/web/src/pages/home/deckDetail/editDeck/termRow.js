import { Checkbox, IconButton, Tooltip } from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineRounded";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import { COLORS } from "@constants/colors";

/**
 * One line in the deck's term list — dense enough that a few dozen terms fit on
 * screen. Clicking anywhere on the row opens the full editor; the checkbox and
 * the trailing buttons keep their own click targets.
 */
function TermRow({ term, position, selected, onToggleSelect, onEdit, onDelete }) {
  const stop = (handler) => (event) => {
    event.stopPropagation();
    handler();
  };

  return (
    <div
      className={`term-row${selected ? " term-row--selected" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => onEdit(term)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onEdit(term);
      }}
    >
      <Checkbox
        checked={selected}
        onClick={stop(() => onToggleSelect(term.id))}
        size="small"
        inputProps={{ "aria-label": `Select ${term.name}` }}
      />
      <span className="term-row__position">{position}</span>
      {term.image ? (
        <img className="term-row__thumb" src={term.image} alt="" loading="lazy" />
      ) : (
        <span className="term-row__thumb term-row__thumb--empty">
          <ImageOutlinedIcon fontSize="small" />
        </span>
      )}
      <div className="term-row__text">
        <span className="term-row__title">
          <span className="term-row__name">{term.name}</span>
          {term.ai_filled && (
            <Tooltip title="Enriched with AI">
              <AutoFixHighIcon className="term-row__ai" fontSize="inherit" />
            </Tooltip>
          )}
        </span>
        <span className="term-row__meaning">
          {term.meaning || <em>No meaning yet</em>}
        </span>
      </div>
      <div className="term-row__buttons">
        <Tooltip title="Edit term">
          <IconButton size="small" onClick={stop(() => onEdit(term))}>
            <EditOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete term">
          <IconButton
            size="small"
            onClick={stop(() => onDelete(term))}
            sx={{ "&:hover": { color: COLORS.ERROR_RED } }}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </div>
    </div>
  );
}

export default TermRow;
