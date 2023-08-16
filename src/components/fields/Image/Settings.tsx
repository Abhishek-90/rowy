import { ISettingsProps } from "@src/components/fields/types";
import FormGroup from "@mui/material/FormGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";

export default function Settings({ onChange, config }: ISettingsProps) {
  return (
    <FormGroup>
      <FormControlLabel control={<Checkbox defaultChecked />} label="Label" />
    </FormGroup>
  );
}
