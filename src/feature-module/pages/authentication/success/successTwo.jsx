import { all_routes } from "../../../../routes/all_routes";
import { Link } from "react-router-dom";
import { authentication06, checkIcon, logo, logoWhite } from "../../../../utils/imagepath";

const SuccessTwo = () => {
  const route = all_routes;

  return (
    <div>
      <>
        {/* Main Wrapper */}
        <div className="main-wrapper">
          <div className="account-content">
            <div className="row login-wrapper">
              <div className="col-lg-6">
                <div className="login-content">
                  <div className="login-userset">
                    <div className="login-userset">
                      <div className="login-logo logo-normal">
                        <img src={logo} alt="img" />
                      </div>
                    </div>
                    <Link to="index.html" className="login-logo logo-white">
                      <img src={logoWhite} alt="Img" />
                    </Link>
                    <div className="login-userheading text-center">
                      <img src={checkIcon} alt="Icon" />
                      <h3 className="text-center">Success</h3>
                      <h4 className="verfy-mail-content text-center">
                        Your Passwrod Reset Successfully!
                      </h4>
                    </div>
                    <div className="form-login">
                      <Link className="btn btn-login mt-0" to={route.signintwo}>
                        Back to Login
                      </Link>
                    </div>
                    <div className="my-4 d-flex justify-content-center align-items-center copyright-text">
                      <p>Copyright © 2026 <a href="https://breezetechnologies.co.ke" className="text-primary text-decoration-none" target="_blank" rel="noopener noreferrer">BreezeTech</a></p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-lg-6">
                <div className="login-img">
                  <img
                    src={authentication06}
                    alt="img" />
                  
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* /Main Wrapper */}
      </>
    </div>);

};

export default SuccessTwo;