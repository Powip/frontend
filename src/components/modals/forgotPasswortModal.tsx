import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import axios from "axios";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ForgotPassword({ open, onClose }: Props) {
  const [email, setEmail] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const handleOnSend = async () => {
    if (!email.trim()) {
      toast.warning("Por favor, ingresá un correo electrónico válido.");
      return;
    }
    try {
      setLoading(true);
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_USERS}/auth/forgot-password`,
        { email },
      );
      if (response.status === 200) {
        toast.success(
          "Se ha enviado un correo para restablecer tu contraseña.",
        );
        setEmail("");
        onClose();
      }
    } catch (error) {
      console.log(error);
      toast.error(
        "Hemos tenido un error al enviar el correo. Inténtalo más tarde.",
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="!max-w-[90vw] sm:!max-w-[500px] !w-full">
        <DialogHeader>
          <DialogTitle>Recupera tu contraseña</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p>
            Ingresá tu correo electrónico y te enviaremos un enlace para
            restablecer tu contraseña.
          </p>
          <Input onChange={(e) => setEmail(e.target.value)} value={email} />
        </div>
        <Button
          onClick={handleOnSend}
          disabled={loading}
          className="w-full mt-4"
        >
          {loading ? "Enviando..." : "Enviar"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
