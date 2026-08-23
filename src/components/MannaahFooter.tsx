import { Link } from "react-router-dom";

export function MannaahFooter() {
  return (
    <footer className="border-t border-[#DED8CC] bg-[#F8F5EE]">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-[#3F4D42]">Mannaah</p>
            <p className="mt-1 text-sm text-[#7A756B]">
              Help doesn't ask where you're from.
            </p>
          </div>

          <nav className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-[#5F665F]">
            <Link to="/about" className="hover:text-[#3F4D42]">About</Link>
            <Link to="/campaigns" className="hover:text-[#3F4D42]">Browse Campaigns</Link>
            <Link to="/campaigns/new" className="hover:text-[#3F4D42]">Create Campaign</Link>
            <Link to="/support-mannaah" className="hover:text-[#3F4D42]">Support Mannaah</Link>
            <Link to="/privacy" className="hover:text-[#3F4D42]">Privacy</Link>
            <Link to="/safety" className="hover:text-[#3F4D42]">Safety</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}

export default MannaahFooter;
