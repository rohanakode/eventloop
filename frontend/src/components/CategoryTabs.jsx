import { Box, Stack } from "@mui/material";
import { tokens } from "../theme";

export default function CategoryTabs({ categories, active, onChange }) {
  return (
    <Stack
      direction="row"
      spacing={0.75}
      sx={{
        borderBottom: `1px solid ${tokens.line}`,
        mt: 6,
        overflowX: "auto",
        "&::-webkit-scrollbar": { display: "none" },
      }}
    >
      {categories.map((cat) => {
        const isActive = cat.key === active;
        return (
          <Box
            key={cat.key}
            onClick={() => onChange(cat.key)}
            sx={{
              fontSize: 15,
              fontWeight: isActive ? 600 : 500,
              color: isActive ? tokens.ink : tokens.muted,
              px: 2,
              py: 1.75,
              cursor: "pointer",
              whiteSpace: "nowrap",
              borderBottom: `2px solid ${isActive ? tokens.accent : "transparent"}`,
              "&:hover": { color: tokens.ink },
            }}
          >
            {cat.label}
            <Box component="span" sx={{ fontSize: 12, color: "#bcb4a4", ml: 0.6 }}>
              {cat.count}
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
}
