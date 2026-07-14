import React from "react";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import SettingsBrightnessOutlinedIcon from "@mui/icons-material/SettingsBrightnessOutlined";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import { useAppTheme } from "@app/themeContext";
import { CATEGORY_ORDER, PALETTE_CATEGORIES } from "@constants/themes";

const MODE_OPTIONS = [
  { id: "light", label: "Light", Icon: LightModeOutlinedIcon },
  { id: "dark", label: "Dark", Icon: DarkModeOutlinedIcon },
  { id: "system", label: "System", Icon: SettingsBrightnessOutlinedIcon },
];

function PaletteSwatch({ palette, selected, onSelect }) {
  const [from, to] = palette.gradient;
  return (
    <button
      type="button"
      className={`palette-swatch${selected ? " palette-swatch--selected" : ""}`}
      onClick={() => onSelect(palette.id)}
      aria-pressed={selected}
      aria-label={palette.name}
    >
      <span
        className="palette-swatch__chip"
        style={{ backgroundImage: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` }}
      >
        {selected && <CheckRoundedIcon fontSize="small" />}
      </span>
      <span className="palette-swatch__name">{palette.name}</span>
    </button>
  );
}

function AppearanceSettings() {
  const { mode, palette, setMode, setPalette } = useAppTheme();

  return (
    <div className="settings-card appearance-card" data-tour="settings-appearance">
      <h5 className="settings-section-title">Appearance</h5>

      <div className="settings-field">
        <label>Color mode</label>
        <small className="appearance-hint">
          Choose Light or Dark, or follow your device settings.
        </small>
        <div className="mode-options">
          {MODE_OPTIONS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              className={`mode-option${mode === id ? " mode-option--active" : ""}`}
              onClick={() => setMode(id)}
              aria-pressed={mode === id}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <hr className="settings-divider" />

      <div className="settings-field">
        <label>Color theme</label>
        <small className="appearance-hint">
          Pick an accent palette — it applies across the whole app instantly.
        </small>

        {CATEGORY_ORDER.map((category) => (
          <div key={category} className="palette-group">
            <div className="palette-group__title">{category}</div>
            <div className="palette-grid">
              {(PALETTE_CATEGORIES[category] || []).map((p) => (
                <PaletteSwatch
                  key={p.id}
                  palette={p}
                  selected={palette === p.id}
                  onSelect={setPalette}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AppearanceSettings;
