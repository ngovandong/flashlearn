import React, { useState } from "react";
import { createSearchParams, Link, useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";

import authService from "@api-services/authService";
import cloudinaryService from "@api-services/cloudinaryService";

function SignUp() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handle_submit = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError("Password not match!");
    } else {
      let url = "";
      if (avatar) {
        url = await cloudinaryService.uploadImage(avatar);
      }
      const user = {
        first_name: firstName,
        last_name: lastName,
        email,
        password,
        name: firstName + " " + lastName,
        image_url: url,
      };
      try {
        const res = await authService.signUp(user);
        if (res.status === 201) {
          const info = `We've sent a verification link to ${email}. Please click it to activate your account.`;
          navigate({
            pathname: "/login",
            search: createSearchParams({
              info,
            }).toString(),
          });
        } else {
          // handle error
          const data = res.response.data;
          const firstKeyError = Object.keys(data)[0];
          const error = Array.isArray(data[firstKeyError])
            ? data[firstKeyError][0]
            : data[firstKeyError];
          const errorMessage = firstKeyError + ": " + error;
          setError(errorMessage);
        }
      } catch (error) {
        console.log(error);
      }
    }
  };
  return (
    <div className="signup-login-page">
      {error && (
        <Alert
          onClose={() => {
            setError("");
          }}
          severity="error"
        >
          {error}
        </Alert>
      )}
      <div className="form">
        <form onSubmit={handle_submit}>
          <h1>Sign up</h1>

          <label>First name</label>
          <input
            type="text"
            onChange={(e) => setFirstName(e.target.value)}
            name="first_name"
            placeholder="Enter your first name..."
            value={firstName}
            required
          />
          <br />

          <label>Last name</label>
          <input
            type="text"
            onChange={(e) => setLastName(e.target.value)}
            name="last_name"
            placeholder="Enter your last name..."
            value={lastName}
            required
          />
          <br />

          <label>Email</label>
          <input
            type="email"
            onChange={(e) => setEmail(e.target.value)}
            name="email"
            placeholder="Enter your email address..."
            value={email}
            required
          />
          <br />

          <label>Avatar</label>
          <label htmlFor="custom-file-upload" className="filupp">
            <span className="filupp-file-name">
              {avatar ? avatar.name : "Browse Files"}
            </span>
            <input
              type="file"
              name="attachment-file"
              id="custom-file-upload"
              required
              onChange={(e) => setAvatar(e.target.files[0])}
              accept="image/*"
            />
          </label>

          <label>Password</label>
          <input
            type="password"
            onChange={(e) => setPassword(e.target.value)}
            name="password"
            placeholder="Enter your password..."
            value={password}
            required
          />
          <br />

          <label>Confirm password</label>
          <input
            type="password"
            onChange={(e) => setConfirmPassword(e.target.value)}
            name="confirm_password"
            placeholder="Confirm your password..."
            value={confirmPassword}
            required
          />
          <br />

          <input type="submit" value="Sign up" />

          <div className="bottom-text">
            <p>Already have an account?</p>
            <Link className="link" to="/login">
              Log In
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SignUp;
