import { Outlet } from "react-router-dom";
import { MannaahNav } from "./MannaahNav";
import { MannaahFooter } from "./MannaahFooter";

export function MannaahShell() {
  return (
    <div className="min-h-dvh bg-[#F8F5EE] text-[#3F4D42]">
      <MannaahNav />

      <main className="min-h-[calc(100dvh-80px)]">
        <Outlet />
      </main>

      <MannaahFooter />
    </div>
  );
}

export default MannaahShell;
