import LandingPhoneBookingDemo from './LandingPhoneBookingDemo';
import './landing-phone-embed.css';

export default function PhoneMockup() {
  return (
    <div className="lt-phone">
      <div className="lt-phone__glow" aria-hidden />
      <div className="lt-phone__device">
        <div className="lt-phone__notch" aria-hidden />
        <div className="lt-phone__screen">
          <div className="lt-phone__embed">
            <div className="lt-phone__embed-viewport">
              <LandingPhoneBookingDemo />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
