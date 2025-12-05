import {
  createStyles,
  Header,
  Container,
  Group,
  Burger,
  rem,
  Button,
} from "@mantine/core";
import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Package } from "lucide-react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../config/firebase";

const useStyles = createStyles((theme) => ({
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    height: "100%",
    marginLeft: 85,
    marginRight: 85,
  },

  brand: {
    fontSize: rem(24),
    fontWeight: 700,
    color: "#7A5848",
    textDecoration: "none",
    "&:hover": {
      textDecoration: "none",
    },
  },

  navGroup: {
    display: "flex",
    alignItems: "center",
    gap: 0,
    marginLeft: "auto",
  },

  links: {
    [theme.fn.smallerThan("xs")]: {
      display: "none",
    },
  },

  burger: {
    [theme.fn.largerThan("xs")]: {
      display: "none",
    },
  },

  link: {
    display: "block",
    lineHeight: 1,
    padding: `${rem(8)} ${rem(12)}`,
    borderRadius: theme.radius.sm,
    textDecoration: "none",
    color: theme.colors.gray[7],
    fontSize: theme.fontSizes.sm,
    fontWeight: 500,
  },

  linkActive: {
    "&, &:hover": {
      backgroundColor: "#FAF7F2",
    },
  },
}));

interface HeaderSimpleProps {
  links: { link: string; label: string }[];
}

export function HeaderSimple({ links }: HeaderSimpleProps) {
  const [opened, setOpened] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const location = useLocation();
  const { classes, cx } = useStyles();

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  // Filter nav links: remove "Sign In" and "My Reservations" (button handles it)
  const navLinks = links.filter((link) => {
    if (link.label === "Sign In") return false;
    if (link.label === "My Reservations") return false; // Always remove from nav, button handles it
    return true;
  });

  const items = navLinks.map((link) => (
    <Link
      key={link.label}
      to={link.link}
      className={cx(classes.link, {
        [classes.linkActive]: location.pathname === link.link,
      })}
    >
      {link.label}
    </Link>
  ));

  return (
    <Header
      height={70}
      style={{
        backgroundColor: "#ffffff",
        borderBottom: "none",
        boxShadow: "none",
      }}
    >
      <Container fluid className={classes.header} px={0}>
        <Group spacing={0}>
          <Package size={24} color="#7A5848" style={{ marginRight: 10 }} />
          <Link to="/" className={classes.brand}>
            BearBox
          </Link>
        </Group>
        <Group className={classes.navGroup}>
          <Group spacing={0} className={classes.links}>
            {items}
          </Group>
          {user ? (
            <Button
              component={Link}
              to="/reservations"
              variant="filled"
              style={{
                backgroundColor: "#000000",
                color: "#FFFFFF",
              }}
            >
              My Reservations
            </Button>
          ) : (
            <Button
              component={Link}
              to="/signin"
              variant="filled"
              style={{
                backgroundColor: "#000000",
                color: "#FFFFFF",
              }}
            >
              Sign In
            </Button>
          )}
          <Burger
            opened={opened}
            onClick={() => setOpened((o) => !o)}
            className={classes.burger}
            size="sm"
          />
        </Group>
      </Container>
    </Header>
  );
}
