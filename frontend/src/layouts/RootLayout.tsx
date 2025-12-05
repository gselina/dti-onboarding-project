import { HeaderSimple } from "../components/Header";
import { PATHS } from "../constants/Navigation";
import { Outlet } from "react-router-dom";

const RootLayout = () => (
    <div style={{ width: "100%", minWidth: "100%" }}>
        <HeaderSimple links={PATHS} />
        <div style={{ width: "100%" }}>
            <Outlet />
        </div>
    </div>
);

export default RootLayout;
