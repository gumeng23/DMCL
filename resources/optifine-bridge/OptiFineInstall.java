package amcl;

import java.io.File;

public final class OptiFineInstall {
    public static void main(String[] args) throws Exception {
        if (args.length < 1) {
            System.err.println("Usage: OptiFineInstall <minecraft-dir>");
            System.exit(2);
        }
        optifine.Installer.doInstall(new File(args[0]));
    }
}