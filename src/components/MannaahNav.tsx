import { Link, useLocation } from "react-router-dom";
import { Heart, Menu, X } from "lucide-react";
import { useState } from "react";

export function MannaahNav() {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const links = [
    { label: "Home", path: "/" },
    { label: "Browse Campaigns", path: "/campaigns" },
    { label: "Create Campaign", path: "/campaigns/new" },
    { label: "My Help", path: "/my-help" },
    { label: "About Us", path: "/about" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-[#e8dfd2] bg-[#faf8f3]/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link
          to="/"
          className="flex items-center gap-3"
          onClick={() => setOpen(false)}
        >
          <img
            src="/logo.svg"
            alt="Mannaah"
            className="h-10 w-10"
          />
          <span className="text-2xl font-semibold tracking-tight text-[#3f4d42]">
            Mannaah
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {links.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`text-sm font-medium transition-colors ${
                location.pathname === link.path
                  ? "text-[#6b7b68]"
                  : "text-[#5f625d] hover:text-[#3f4d42]"
              }`}
            >
              {link.label}
            </Link>
          ))}

          <Link
            to="/support-mannaah"
            className="inline-flex items-center gap-2 rounded-full bg-[#6b7b68] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <Heart className="size-4" />
            Support Mannaah
          </Link>
        </nav>

        <button
          type="button"
          aria-label="Toggle navigation"
          className="rounded-lg p-2 text-[#3f4d42] md:hidden"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-[#e8dfd2] bg-[#faf8f3] px-4 py-4 md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1">
            {links.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-sm font-medium text-[#3f4d42] hover:bg-[#f0eadf]"
              >
                {link.label}
              </Link>
            ))}

            <Link
              to="/support-mannaah"
              onClick={() => setOpen(false)}
              className="mt-2 rounded-lg bg-[#6b7b68] px-3 py-3 text-center text-sm font-semibold text-white"
            >
              Support Mannaah
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
