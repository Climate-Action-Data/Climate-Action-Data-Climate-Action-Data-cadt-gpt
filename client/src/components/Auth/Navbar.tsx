import React from 'react';

const Navbar = () => {
  return (
    <header className="bg-white shadow-md">
      <div className="container mx-auto px-4 py-4">
        <nav className="flex justify-between items-center">
          <a href="https://climateactiondata.org" className="flex items-center">
            <img
              className="h-8 w-auto mr-2"
              src="https://climateactiondata.org/wp-content/uploads/2022/10/site-logo.svg"
              alt="Climate Action Data Trust logo"
            />
            <span className="font-bold text-lg">Climate Action Data Trust</span>
          </a>
          <div className="flex items-center">
            <ul className="flex space-x-4">
              <li>
                <a href="https://climateactiondata.org/about/" className="text-gray-600 hover:text-gray-900">
                  About
                </a>
              </li>
              <li>
                <a href="https://climateactiondata.org/data-dashboard/" className="text-gray-600 hover:text-gray-900">
                  Data Dashboard
                </a>
              </li>
              <li>
                <a href="https://climateactiondata.org/news-events/" className="text-gray-600 hover:text-gray-900">
                  News &amp; Events
                </a>
              </li>
              <li>
                <a href="https://climateactiondata.org/frequently-asked-questions/" className="text-gray-600 hover:text-gray-900">
                  FAQ
                </a>
              </li>
              <li>
                <a href="https://climateactiondata.org/careers/" className="text-gray-600 hover:text-gray-900">
                  Careers
                </a>
              </li>
              <li>
                <a href="https://climateactiondata.org/contact/" className="text-gray-600 hover:text-gray-900">
                  Contact Us
                </a>
              </li>
            </ul>
            <ul className="flex space-x-4 ml-4">
              <li>
                <a href="https://twitter.com/CAD_Trust" className="text-gray-600 hover:text-gray-900">
                  {/* Your Twitter SVG icon */}
                </a>
              </li>
              <li>
                <a href="https://www.linkedin.com/company/climate-action-data-trust/" className="text-gray-600 hover:text-gray-900">
                  {/* Your LinkedIn SVG icon */}
                </a>
              </li>
            </ul>
          </div>
        </nav>
      </div>
    </header>
  );
};

export default Navbar;