import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { TLoginUser } from '~/data-provider';
import { useAuthContext } from '~/hooks/AuthContext';
import { useNavigate } from 'react-router-dom';
import Navbar from './Navbar'; // import the Navbar component
import './Login.css'; // import the custom css
import { FaChevronLeft } from 'react-icons/fa';


function Login() {
  const { login, error, isAuthenticated } = useAuthContext();
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<TLoginUser>();

  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/chat/new');
    }
  }, [isAuthenticated, navigate]);

  const SERVER_URL = import.meta.env.DEV
    ? import.meta.env.VITE_SERVER_URL_DEV
    : import.meta.env.VITE_SERVER_URL_PROD;
  const showGoogleLogin = import.meta.env.VITE_SHOW_GOOGLE_LOGIN_OPTION === 'true';

  return (
    <div className="min-h-screen bg-white">
      <button
        className="absolute top-0 left-0 z-10 p-6 opacity-80 bg-transparent"
        onClick={() => window.location.href = 'https://climateactiondata.org'}
      >
        <FaChevronLeft className="text-white text-3xl" />
      </button>
      {/* <Navbar /> */}
      <div className="home-banner flex min-h-screen flex-col items-center justify-center bg-white pt-6 sm:pt-0">
        <img
          src="https://climateactiondata.org/wp-content/uploads/2022/10/site-logo.svg"
          alt="Logo"
          className="mx-auto mb-6 h-12 w-auto"
        />
        <div className="mt-6 w-96 overflow-hidden bg-white px-6 py-8 pt-12 sm:max-w-md sm:rounded-lg">
          <h1 className="mb-4 text-center text-3xl font-semibold">Welcome to CADT-GPT</h1>
          {error && (
            <div
              className="relative mt-4 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700"
              role="alert"
            >
              Unable to login with the information provided. Please check your credentials and try
              again.
            </div>
          )}
          <form
            className="mt-6"
            aria-label="Login form"
            method="POST"
            onSubmit={handleSubmit((data) => login(data))}
          >
            <div className="mb-2">
              <div className="relative">
                <input
                  type="email"
                  id="email"
                  autoComplete="email"
                  aria-label="Email"
                  {...register('email', {
                    required: 'Email is required',
                    minLength: {
                      value: 3,
                      message: 'Email must be at least 6 characters'
                    },
                    maxLength: {
                      value: 120,
                      message: 'Email should not be longer than 120 characters'
                    },
                    pattern: {
                      value: /\S+@\S+\.\S+/,
                      message: 'You must enter a valid email address'
                    }
                  })}
                  aria-invalid={!!errors.email}
                  className="peer block w-full appearance-none rounded-t-md border-0 border-b-2 border-gray-300 bg-gray-50 px-2.5 pb-2.5 pt-5 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-0"
                  placeholder=" "
                ></input>
                <label
                  htmlFor="email"
                  className="absolute left-2.5 top-4 z-10 origin-[0] -translate-y-4 scale-75 transform text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:text-green-500"
                >
                  Email address
                </label>
              </div>
              {errors.email && (
                <span role="alert" className="mt-1 text-sm text-red-600">
                  {/* @ts-ignore */}
                  {errors.email.message}
                </span>
              )}
            </div>
            <div className="mb-2">
              <div className="relative">
                <input
                  type="password"
                  id="password"
                  autoComplete="current-password"
                  aria-label="Password"
                  {...register('password', {
                    required: 'Password is required',
                    minLength: {
                      value: 8,
                      message: 'Password must be at least 8 characters'
                    },
                    maxLength: {
                      value: 40,
                      message: 'Password must be less than 40 characters'
                    }
                  })}
                  aria-invalid={!!errors.password}
                  className="peer block w-full appearance-none rounded-t-md border-0 border-b-2 border-gray-300 bg-gray-50 px-2.5 pb-2.5 pt-5 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-0"
                  placeholder=" "
                ></input>
                <label
                  htmlFor="password"
                  className="absolute left-2.5 top-4 z-10 origin-[0] -translate-y-4 scale-75 transform text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:text-green-500"
                >
                  Password
                </label>
              </div>

              {errors.password && (
                <span role="alert" className="mt-1 text-sm text-red-600">
                  {/* @ts-ignore */}
                  {errors.password.message}
                </span>
              )}
            </div>
            <a href="/forgot-password" className="text-sm text-green-500 hover:underline">
              Forgot Password?
            </a>
            <div className="mt-6">
              <button
                aria-label="Sign in"
                type="submit"
                className="w-full transform rounded-sm bg-green-500 px-4 py-3 tracking-wide text-white transition-colors duration-200 hover:bg-green-600 focus:bg-green-600 focus:outline-none"
              >
                Continue
              </button>
            </div>
          </form>
          <p className="my-4 text-center text-sm font-light text-gray-700">
            {' '}
            Don't have an account?{' '}
            <a href="/register" className="p-1 text-green-500 hover:underline">
              Sign up
            </a>
          </p>
          {showGoogleLogin && (
            <>
              <div className="relative mt-6 flex w-full items-center justify-center border border-t uppercase">
                <div className="absolute bg-white px-3 text-xs">Or</div>
              </div>
              <div className="mt-4 flex gap-x-2">
                <a
                  aria-label="Login with Google"
                  className="justify-left flex w-full items-center space-x-3 rounded-md border border-gray-300 px-5 py-3 hover:bg-gray-50 focus:ring-2 focus:ring-violet-600 focus:ring-offset-1"
                  href={`${SERVER_URL}/oauth/google`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 512 512"
                    id="google"
                    className="h-5 w-5"
                  >
                    <path
                      fill="#fbbb00"
                      d="M113.47 309.408 95.648 375.94l-65.139 1.378C11.042 341.211 0 299.9 0 256c0-42.451 10.324-82.483 28.624-117.732h.014L86.63 148.9l25.404 57.644c-5.317 15.501-8.215 32.141-8.215 49.456.002 18.792 3.406 36.797 9.651 53.408z"
                    ></path>
                    <path
                      fill="#518ef8"
                      d="M507.527 208.176C510.467 223.662 512 239.655 512 256c0 18.328-1.927 36.206-5.598 53.451-12.462 58.683-45.025 109.925-90.134 146.187l-.014-.014-73.044-3.727-10.338-64.535c29.932-17.554 53.324-45.025 65.646-77.911h-136.89V208.176h245.899z"
                    ></path>
                    <path
                      fill="#28b446"
                      d="m416.253 455.624.014.014C372.396 490.901 316.666 512 256 512c-97.491 0-182.252-54.491-225.491-134.681l82.961-67.91c21.619 57.698 77.278 98.771 142.53 98.771 28.047 0 54.323-7.582 76.87-20.818l83.383 68.262z"
                    ></path>
                    <path
                      fill="#f14336"
                      d="m419.404 58.936-82.933 67.896C313.136 112.246 285.552 103.82 256 103.82c-66.729 0-123.429 42.957-143.965 102.724l-83.397-68.276h-.014C71.23 56.123 157.06 0 256 0c62.115 0 119.068 22.126 163.404 58.936z"
                    ></path>
                  </svg>
                  <p>Login with Google</p>
                </a>

                {/* <a 
                  aria-label="Login with Facebook"
                  className="flex w-full items-center justify-center rounded-md border border-gray-600 p-2 focus:ring-2 focus:ring-violet-600 focus:ring-offset-1"
                  href="http://localhost:3080/auth/facebook">
                  <FontAwesomeIcon
                    icon={faFacebook} 
                    size={'lg'}
                  />
                </a> */}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;
