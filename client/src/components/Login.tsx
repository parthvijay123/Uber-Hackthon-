import { useState } from 'react'

interface LoginProps {
    onLogin: (driverId: string) => void
}

export default function Login({ onLogin }: LoginProps) {
    const [driverId, setDriverId] = useState('')

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (driverId.trim()) {
            onLogin(driverId.trim().toUpperCase())
        }
    }

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-logo"><img src="/uber.png" alt="Uber" /></div>
                <h2>Driver Pulse</h2>
                <p>Enter your Driver ID to view pacing & safety forensics.</p>

                <form onSubmit={handleSubmit} className="login-form">
                    <input
                        type="text"
                        placeholder="Ex: DRV001"
                        value={driverId}
                        onChange={e => setDriverId(e.target.value)}
                        className="login-input"
                        autoFocus
                    />
                    <button type="submit" className="btn-primary login-btn">Sign In</button>
                </form>
            </div>
        </div>
    )
}
