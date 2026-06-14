import React, { useEffect, useState } from "react";
import { Alert, Snackbar, Switch, TextField } from "@mui/material";
import { LocalLoadingWrapper } from "@components/loading";
import { userSettingService } from "@api-services/userSettingService";
import { getFirstError } from "@utils/errorHandler";
import AppearanceSettings from "./appearanceSettings";

function UserSettings() {
  const [settings, setSettings] = useState({ daily_reminder: false, reminder_email: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      const res = await userSettingService.getSettings();
      if (!res.error) {
        setSettings(res.data);
      } else {
        setError(getFirstError(res.error));
      }
      setIsLoading(false);
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    const res = await userSettingService.updateSettings(settings);
    if (!res.error) {
      setSettings(res.data);
      setSuccess(true);
    } else {
      setError(getFirstError(res.error));
    }
    setIsSaving(false);
  };

  return (
    <div className="settings-page">
      <LocalLoadingWrapper open={isLoading || isSaving} />

      <div className="settings-header">
        <h2>Settings</h2>
      </div>

      <AppearanceSettings />

      <div className="settings-card">
        <h5 className="settings-section-title">Notifications</h5>

        <div className="settings-row">
          <div className="settings-row__label">
            <span>Daily study reminder</span>
            <small>Receive a daily email to keep your study streak going.</small>
          </div>
          <Switch
            checked={!!settings.daily_reminder}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, daily_reminder: e.target.checked }))
            }
            sx={{
              "& .MuiSwitch-switchBase.Mui-checked": { color: "var(--fl-primary)" },
              "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                backgroundColor: "var(--fl-primary)",
              },
            }}
          />
        </div>

        <hr className="settings-divider" />

        <div className="settings-field">
          <TextField
            label="Reminder email"
            variant="standard"
            fullWidth
            type="email"
            value={settings.reminder_email ?? ""}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, reminder_email: e.target.value }))
            }
          />
        </div>
      </div>

      <div className="settings-footer">
        <div className={`main-btn${isSaving ? " disabled" : ""}`} onClick={!isSaving ? handleSave : undefined}>
          Save
        </div>
      </div>

      <Snackbar
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        open={success}
        autoHideDuration={3000}
        onClose={() => setSuccess(false)}
      >
        <Alert onClose={() => setSuccess(false)} severity="success">
          Settings saved.
        </Alert>
      </Snackbar>

      <Snackbar
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        open={error != null}
        autoHideDuration={4000}
        onClose={() => setError(null)}
      >
        <Alert onClose={() => setError(null)} severity="error">
          {error}
        </Alert>
      </Snackbar>
    </div>
  );
}

export default UserSettings;
